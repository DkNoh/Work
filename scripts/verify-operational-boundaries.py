#!/usr/bin/env python3
"""실제 운영 JAR의 예약·브라우저 경계를 새 H2와 합성 계정에서만 확인한다."""
import argparse
import concurrent.futures
import copy
import datetime
import http.client
import hashlib
import http.cookiejar
import json
import os
import pathlib
import re
import secrets
import shutil
import socket
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

from _harness import ROOT
from _operations_harness import operations_server


REPORT_PATH = "/api/operations/browser-errors"
SCHEDULE_PATH = "/api/operations/jobs/schedules"
CANARY = "PRIVATE_BROWSER_REPORT_CANARY"


class BoundaryFailure(AssertionError):
    """이 스크립트가 작성한 고정 검사 설명만 전달한다."""


def check(condition, message):
    if not condition:
        raise BoundaryFailure(message)


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def java_binary():
    candidate = os.environ.get("JAVA_BIN")
    if not candidate and os.environ.get("JAVA21_HOME"):
        candidate = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
    return str(pathlib.Path(shutil.which(candidate or "java") or candidate or "java").resolve())


class Client:
    """쿠키/CSRF는 메모리에만 두며 실패 기록에 요청·응답 원문을 넣지 않는다."""
    def __init__(self, server):
        self.server = server
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = None

    def clone(self):
        client = Client(self.server)
        for cookie in self.cookies:
            client.cookies.set_cookie(copy.copy(cookie))
        client.csrf = dict(self.csrf) if self.csrf else None
        return client

    def headers(self, method, csrf=True):
        headers = {"Content-Type": "application/json"}
        if method not in ("GET", "HEAD", "OPTIONS") and csrf:
            if self.csrf is None:
                self.csrf = self.request("/api/auth/csrf")
            headers[self.csrf["headerName"]] = self.csrf["token"]
        return headers

    def raw(self, path, method="GET", body=None, csrf=True, form=False):
        headers = self.headers(method, csrf)
        if form:
            body = urllib.parse.urlencode(body).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif body is not None and not isinstance(body, bytes):
            body = json.dumps(body, separators=(",", ":")).encode()
        request = urllib.request.Request(self.server.base_url + path, data=body, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, dict(response.headers), response.read()

    def request(self, path, method="GET", body=None, expected=200, csrf=True, form=False):
        status, headers, content = self.raw(path, method, body, csrf, form)
        if status != expected:
            raise BoundaryFailure(f"Unexpected operational HTTP status: expected {expected}, observed {status}")
        return json.loads(content) if content and "application/json" in headers.get("Content-Type", "") else content

    def login(self, username="admin", password=None):
        self.request("/api/auth/login", "POST", {"username": username, "password": password or self.server.password}, expected=204, form=True)
        self.csrf = self.request("/api/auth/csrf")

    def chunked(self, body):
        headers = self.headers("POST")
        request = urllib.request.Request(self.server.base_url + REPORT_PATH)
        self.cookies.add_cookie_header(request)
        if request.has_header("Cookie"):
            headers["Cookie"] = request.get_header("Cookie")
        address = urllib.parse.urlsplit(self.server.base_url)
        connection = http.client.HTTPConnection(address.hostname, address.port, timeout=15)
        try:
            # iterator에 Content-Length를 붙이지 않는다. 실제 HTTP/1.1 chunked framing이다.
            chunks = (body[start:start + 1024] for start in range(0, len(body), 1024))
            connection.request("POST", REPORT_PATH, body=chunks, headers=headers, encode_chunked=True)
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()


def browser_input(event_id=None, event_code="VUE_ERROR"):
    return {"schemaVersion": 1, "clientEventId": event_id or str(uuid.uuid4()), "source": "VUE",
            "eventCode": event_code, "appVersion": "0.1.0", "routeCode": "operations-schedules", "componentCode": "ROOT"}


def schedules(client):
    return client.request(SCHEDULE_PATH + "?page=0&size=100")["items"]


def groups(client):
    return client.request(REPORT_PATH + "/groups?page=0&size=100")["items"]


def runs(client, schedule_id):
    return client.request("/api/operations/jobs/runs?size=100&scheduleId=" + str(schedule_id))["items"]


def receipt_count(client):
    return sum(item["occurrenceCount"] for item in groups(client))


def safe_logs(server):
    values = [server.password.encode(), CANARY.encode()]
    values.extend(path.read_bytes().strip() for path in (server.folder / "secrets/operations").iterdir() if path.is_file())
    for path in server.folder.rglob("*"):
        if path.is_file() and path.suffix in (".log", ".ndjson"):
            content = path.read_bytes()
            check(all(not value or value not in content for value in values), "Private value appeared in isolated logs")


def stopped_database_checks(server):
    check(server.process is None, "Database inspection requires a stopped fixture")
    driver = server.folder / "h2-operational-inspection.jar"
    with zipfile.ZipFile(server.jar) as archive:
        entries = [entry for entry in archive.namelist() if re.fullmatch(r"BOOT-INF/lib/h2-[^/]+\.jar", entry)]
        check(len(entries) == 1, "JAR does not contain exactly one H2 driver")
        driver.write_bytes(archive.read(entries[0]))
    expressions = {
        "RAW_COLUMNS": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME LIKE 'BROWSER_ERROR_%' AND COLUMN_NAME IN('MESSAGE','STACK','URL','QUERY','BODY','ERROR')",
        "CANARY_GROUPS": "SELECT COUNT(*) FROM browser_error_group WHERE CONCAT(fingerprint,app_version,source,event_code,route_code,component_code) LIKE '%" + CANARY + "%'",
        "CANARY_OCCURRENCES": "SELECT COUNT(*) FROM browser_error_occurrence WHERE CONCAT(actor_subject,request_id) LIKE '%" + CANARY + "%'",
        "CANARY_RECEIPTS": "SELECT COUNT(*) FROM browser_error_receipt WHERE CONCAT(actor_subject,fingerprint) LIKE '%" + CANARY + "%'",
        "JAVA_OBJECT_PAYLOADS": "SELECT COUNT(*) FROM QRTZ_JOB_DETAILS WHERE SUBSTRING(JOB_DATA,1,2)=X'ACED'",
        "CUSTOM_CALENDARS": "SELECT COUNT(*) FROM QRTZ_CALENDARS",
        "BLOB_TRIGGERS": "SELECT COUNT(*) FROM QRTZ_BLOB_TRIGGERS",
        "PULSE_EFFECTS": "SELECT COUNT(*) FROM operation_pulse_effect",
        "SUCCESS_PULSE_RUNS": "SELECT COUNT(*) FROM operation_job_run WHERE job_code='PULSE' AND state='SUCCESS'",
        "MISSING_PULSE_EFFECTS": "SELECT COUNT(*) FROM operation_job_run r WHERE r.job_code='PULSE' AND r.state='SUCCESS' AND NOT EXISTS(SELECT 1 FROM operation_pulse_effect p WHERE p.run_key=r.run_key)",
    }
    sql = "SELECT " + ", ".join("(" + query + ") AS " + key for key, query in expressions.items()) + ";"
    try:
        result = subprocess.run([java_binary(), "-cp", str(driver), "org.h2.tools.Shell", "-url",
                                 f"jdbc:h2:file:{server.folder / 'data/test'};IFEXISTS=TRUE;ACCESS_MODE_DATA=r", "-user", "sa", "-password", "", "-properties", "null", "-list", "-sql", sql],
                                cwd=server.folder, capture_output=True, text=True, timeout=25)
        check(result.returncode == 0 and not result.stderr.strip() and "Error:" not in result.stdout, "Stopped H2 count inspection failed")
        values = {key: int(value) for key, value in re.findall(r"(?m)^([A-Z_]+)\s*:\s*(\d+)\s*$", result.stdout)}
        check(set(values) == set(expressions), "Stopped H2 inspection returned an unexpected shape")
        check(all(value == 0 for key, value in values.items() if key not in ("PULSE_EFFECTS", "SUCCESS_PULSE_RUNS")), "Unsafe browser or scheduler metadata was persisted")
        check(values["PULSE_EFFECTS"] == values["SUCCESS_PULSE_RUNS"] and values["PULSE_EFFECTS"] >= 1, "Committed PULSE history does not match actual persisted effects")
        return values
    finally:
        driver.unlink(missing_ok=True)


def wait_for_pulse(client, schedule_id, next_fire):
    instant = datetime.datetime.fromisoformat(next_fire.replace("Z", "+00:00")).timestamp()
    remaining = instant - time.time()
    check(remaining <= 70 and instant % 60 == 0, "API minute cron nextFireAt is outside its expected range")
    start = time.monotonic()
    deadline = start + max(30, remaining + 35)
    while time.monotonic() < deadline:
        history = runs(client, schedule_id)
        completed = [item for item in history if item["state"] == "SUCCESS"]
        if completed:
            check(all(item["jobCode"] == "PULSE" and item["attempt"] == 1 and item["reasonCode"] is None for item in completed), "PULSE history has an unexpected execution contract")
            return history, round(time.monotonic() - start, 3)
        check(not any(item["state"] == "FAILED" for item in history), "Registered PULSE failed")
        time.sleep(0.5)
    raise AssertionError("Registered minute PULSE did not complete within its bounded wait")


def validate_application(application, record):
    server = operations_server(application, port=0, management_port=free_port())
    try:
        snapshot=server.folder / "verified-app.jar"
        shutil.copyfile(server.jar,snapshot)
        server.jar=snapshot
        artifact_sha=hashlib.sha256(snapshot.read_bytes()).hexdigest()
        check(stat.S_IMODE(server.secret.stat().st_mode) == 0o600, "Synthetic secret is not private")
        server.start()
        admin = Client(server)
        anonymous = Client(server)
        check(anonymous.request("/api/framework/capabilities", expected=401)["code"] == "AUTH_REQUIRED", "Capabilities was not authenticated")
        anonymous.request(REPORT_PATH, "POST", browser_input(), expected=401)
        anonymous.request(REPORT_PATH, "POST", browser_input(), expected=403, csrf=False)
        admin.login()
        capabilities = admin.request("/api/framework/capabilities")
        check(capabilities == {"messaging": True, "scheduler": True, "browserErrors": True, "observability": True}, "Operations capabilities differ from actual active profile")
        registry = admin.request("/api/operations/jobs/registered")["items"]
        check({item["jobCode"] for item in registry} == {"OUTBOX_DISPATCH", "FILE_RECOVERY", "SAFE_RETENTION", "PULSE"}, "Registered task allowlist differs")
        defaults = schedules(admin)
        check({item["id"] for item in defaults} == {1, 2, 3} and all(item["enabled"] and item["revision"] == 1 for item in defaults), "Default schedules did not bootstrap once")
        check(all(item["jobCode"] != "PULSE" for item in defaults), "PULSE acquired an automatic schedule")
        record(application, "authenticated-capabilities-and-defaults", {"defaultSchedules": 3, "registeredJobs": 4, "jarSha256": artifact_sha})

        payload = {"jobCode": "PULSE", "cron": "0 * * * * ?", "timeZone": "UTC", "misfirePolicy": "SKIP", "enabled": True}
        for invalid in (dict(payload, cron="* * * * * ?"), dict(payload, timeZone="Not/AZone"), dict(payload, jobCode="java.lang.Runtime"), dict(payload, arbitraryClass=CANARY)):
            result = admin.request(SCHEDULE_PATH, "POST", invalid, expected=400)
            check(CANARY not in json.dumps(result), "Invalid scheduler input appeared in response")
        row = admin.request(SCHEDULE_PATH, "POST", payload)
        schedule_id = row["id"]
        check(schedule_id >= 100 and row["revision"] == 1, "Public schedule identity/revision is invalid")
        paused = admin.request(f"{SCHEDULE_PATH}/{schedule_id}/pause", "POST", {"revision": 1})
        check(paused["revision"] == 2 and not paused["enabled"] and paused["nextFireAt"] is None, "Pause did not remove the active trigger")
        conflict = admin.request(f"{SCHEDULE_PATH}/{schedule_id}/resume", "POST", {"revision": 1}, expected=409)
        check(conflict["code"] == "REVISION_CONFLICT", "Stale schedule was not a revision conflict")
        check(admin.request(f"{SCHEDULE_PATH}/{schedule_id}/pause", "POST", {"revision": 2})["revision"] == 2, "No-op pause advanced revision")
        resumed = admin.request(f"{SCHEDULE_PATH}/{schedule_id}/resume", "POST", {"revision": 2})
        check(resumed["revision"] == 3 and resumed["enabled"], "Resume did not preserve revision contract")
        check(admin.request(f"{SCHEDULE_PATH}/{schedule_id}") == resumed, "Direct selected schedule query differs")
        admin.request(f"{SCHEDULE_PATH}/999999999", expected=404)
        record(application, "schedule-validation-cas-pause-resume", {"acceptedRevision": 3, "staleStatus": 409})

        initial_count = receipt_count(admin)
        valid = browser_input()
        for invalid in (dict(valid, message=CANARY), dict(valid, routeCode="/private?token=" + CANARY), dict(valid, appVersion="0.3.0"), dict(valid, componentCode=CANARY)):
            result = admin.request(REPORT_PATH, "POST", invalid, expected=400)
            check(CANARY not in json.dumps(result), "Rejected report leaked the raw canary")
        body = json.dumps(valid, separators=(",", ":")).encode()
        status, content = admin.chunked(body + b" " * (4097 - len(body)))
        check(status == 413 and CANARY.encode() not in content, "Real chunked request bypassed 4 KiB limit")
        check(receipt_count(admin) == initial_count, "Rejected reports changed aggregate count")
        record(application, "browser-401-403-allowlist-and-real-chunked-413", {"chunkedBytes": 4097, "rejectedOccurrences": 0})

        admin.request(REPORT_PATH, "POST", valid, expected=202)
        admin.request(REPORT_PATH, "POST", valid, expected=202)
        check(receipt_count(admin) == initial_count + 1, "Repeated receipt was counted twice")
        clients = [admin.clone() for _ in range(8)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(client.request, REPORT_PATH, "POST", browser_input(), 202) for client in clients]
            for future in futures:
                future.result(timeout=25)
        rows = groups(admin)
        check(len(rows) == 1 and rows[0]["occurrenceCount"] == initial_count + 9, "Concurrent distinct reports lost increments or multiplied groups")
        occurrences = admin.request(f"{REPORT_PATH}/groups/{rows[0]['id']}/occurrences?size=100")
        check(occurrences["total"] == initial_count + 9 and all(set(item) == {"id", "groupId", "actorId", "actorSubject", "requestId", "occurredAt"} for item in occurrences["items"]), "Occurrence safe DTO/count differs")
        mutated = dict(valid, eventCode="UNKNOWN_RUNTIME")
        admin.request(REPORT_PATH, "POST", mutated, expected=400)
        check(receipt_count(admin) == initial_count + 9, "A mismatched duplicate receipt changed its fingerprint")
        record(application, "browser-concurrent-aggregation-and-receipt-idempotency", {"parallelDistinct": 8, "acceptedOccurrences": 9, "groups": 1})

        if application == "reference":
            password = secrets.token_urlsafe(24)
            admin.request("/api/users", "POST", {"username": "operational-reader", "displayName": "합성 운영 요청자", "password": password, "role": "REQUESTER"})
            reader = Client(server)
            reader.login("operational-reader", password)
            reader.request(SCHEDULE_PATH, expected=403)
            reader.request(REPORT_PATH + "/groups", expected=403)
            record(application, "current-requester-cannot-read-admin-operations", {"deniedEndpoints": 2})

        before_rate = receipt_count(admin)
        accepted = 0
        for _ in range(60):
            status, headers, content = admin.raw(REPORT_PATH, "POST", browser_input())
            if status == 429:
                check(json.loads(content)["code"] == "RATE_LIMITED", "Rate limit error code differs")
                retry = int(headers.get("Retry-After", "0"))
                check(1 <= retry <= 60, "Rate limiter did not return a bounded Retry-After")
                break
            check(status == 202, "Unexpected status while reaching actor limit")
            accepted += 1
        else:
            raise AssertionError("Actual HTTP actor limit did not reject reports")
        check(receipt_count(admin) == before_rate + accepted, "Rejected rate-limited report was persisted")
        record(application, "browser-actual-429-with-safe-retry-after", {"acceptedBefore429": accepted, "retryAfterSeconds": retry})

        history, waited = wait_for_pulse(admin, schedule_id, resumed["nextFireAt"])
        check(any(item["state"] == "SUCCESS" for item in history), "Minute PULSE has no committed success history")
        paused = admin.request(f"{SCHEDULE_PATH}/{schedule_id}/pause", "POST", {"revision": 3})
        defaults_before = {item["id"]: item for item in schedules(admin) if item["id"] <= 3}
        system_pause = admin.request(f"{SCHEDULE_PATH}/2/pause", "POST", {"revision": defaults_before[2]["revision"]})
        check(not system_pause["enabled"] and system_pause["revision"] == 2, "Default schedule manual pause failed")
        history_before = runs(admin, schedule_id)
        counts_before = receipt_count(admin)
        record(application, "registered-minute-pulse-actually-executes", {"completedRuns": sum(item["state"] == "SUCCESS" for item in history_before), "observedWaitSeconds": waited})

        server.stop()
        safe_logs(server)
        inspection = stopped_database_checks(server)
        server.start()
        restarted = Client(server)
        restarted.login()
        check(restarted.request(f"{SCHEDULE_PATH}/{schedule_id}") == paused, "Restart overwrote the public paused schedule/revision")
        check(restarted.request(f"{SCHEDULE_PATH}/2") == system_pause, "Restart reset the manually paused default schedule")
        check(runs(restarted, schedule_id) == history_before, "Restart lost or repeated committed PULSE history")
        check(receipt_count(restarted) == counts_before, "Restart lost browser aggregate counts")
        check(len(schedules(restarted)) == 4, "Restart recreated default schedules")
        record(application, "same-h2-restart-preserves-defaults-history-and-receipts", {"preservedSchedules": 4, "preservedPulseRuns": len(history_before), "preservedBrowserOccurrences": counts_before})
        server.stop()
        safe_logs(server)
        check(stopped_database_checks(server) == inspection, "Restart introduced unsafe storage fields")
        record(application, "stopped-h2-safe-fields-and-redacted-logs", {"rawColumns": 0, "rawCanaryRows": 0, "javaSerializedPayloads": 0, "persistedPulseEffects": inspection["PULSE_EFFECTS"]})
    finally:
        server.cleanup()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--application", choices=("reference", "starter", "both"), default="both")
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "docs/검증/012-operational-boundaries-first.json")
    parser.add_argument("--log", type=pathlib.Path, default=ROOT / "docs/검증/012-operational-boundaries-first.log")
    args = parser.parse_args()
    # 재실행은 다른 이름을 사용한다. 최초 실패 근거를 덮어쓰지 않는다.
    if args.report.exists() or args.log.exists():
        print("FAIL evidence target already exists; select new --report and --log paths", flush=True)
        return 2
    report = {"format": 1, "stage": "012", "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "passed": False, "execution": "actual-jars-private-h2-http", "checks": [],
              "limitations": ["single-process actor/global rate limit", "no claim of exactly-once Quartz delivery", "PULSE uses API minute cron; no test-only trigger API", "force-kill recovery is a separate verifier"]}
    lines = []

    def record(application, code, details):
        report["checks"].append({"application": application, "code": code, "passed": True, "details": details})
        line = f"PASS {application} {code}"
        lines.append(line)
        print(line, flush=True)

    application = "preflight"
    try:
        for application in (("reference", "starter") if args.application == "both" else (args.application,)):
            validate_application(application, record)
        report["passed"] = True
        record("all", "private-processes-h2-and-synthetic-secrets-cleaned", {})
    except Exception as error:
        # 예외 인자에 HTTP/SQL/쿠키/토큰/암호가 포함될 수 있으므로 class만 보존한다.
        report["failure"] = {"application": application, "exceptionClass": type(error).__name__, "afterCheck": report["checks"][-1]["code"] if report["checks"] else "preflight"}
        if isinstance(error, BoundaryFailure):
            report["failure"]["safeReason"] = str(error)
        line = f"FAIL {application} actual operational boundary ({type(error).__name__})"
        if isinstance(error, BoundaryFailure):
            line += ": " + str(error)
        lines.append(line)
        print(line, flush=True)
    report["completedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report["passedChecks"] = len(report["checks"])
    for target in (args.report, args.log):
        target.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    args.log.write_text("\n".join(lines) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
