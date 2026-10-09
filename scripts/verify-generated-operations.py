#!/usr/bin/env python3
"""새 외부 소비 앱 JAR만 private 운영 fixture로 검증한다. 비밀·오류 원문은 출력하지 않는다."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import time
import urllib.parse
import uuid
import zipfile
from _harness import ROOT, HttpClient
from _operations_harness import operations_server


class VerificationFailure(RuntimeError):
    pass


def check(condition, code):
    if not condition:
        raise VerificationFailure(code)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait(read, accept, timeout=100):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = read()
        if accept(result):
            return result
        time.sleep(0.5)
    raise VerificationFailure("GENERATED_OPERATIONS_BOUNDED_WAIT")


def inspect_database(server):
    driver = server.folder / "private-h2-verifier.jar"
    with zipfile.ZipFile(server.jar) as jar:
        dependency = next(name for name in jar.namelist() if name.startswith("BOOT-INF/lib/h2-") and name.endswith(".jar"))
        driver.write_bytes(jar.read(dependency))
    java = os.environ.get("JAVA_BIN") or str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
    sql = """SELECT COUNT(*) AS NOTE_ROWS FROM starter_note;
SELECT COUNT(*) AS PULSE_EFFECTS FROM operation_pulse_effect;
SELECT COUNT(*) AS PULSE_RUNS FROM operation_job_run WHERE job_code='PULSE' AND state='SUCCESS';
SELECT COUNT(*) AS MESSAGE_COMPLETED FROM sc_message_outbox WHERE type='MESSAGE_DEMO' AND state='COMPLETED';
SELECT COUNT(*) AS RAW_COLUMNS FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME LIKE 'BROWSER_ERROR_%' AND COLUMN_NAME IN('MESSAGE','STACK','URL','QUERY','RAW_BODY');"""
    result = subprocess.run([java, "-cp", str(driver), "org.h2.tools.Shell", "-url", f"jdbc:h2:file:{server.folder / 'data/test'};IFEXISTS=TRUE;ACCESS_MODE_DATA=r", "-user", "sa", "-password", "", "-properties", "null", "-list", "-sql", sql], capture_output=True, text=True, timeout=30)
    driver.unlink()
    check(result.returncode == 0 and "Error" not in result.stdout + result.stderr, "GENERATED_OPERATIONS_DB_INSPECTION")
    values = {name: int(value) for name, value in re.findall(r"(NOTE_ROWS|PULSE_EFFECTS|PULSE_RUNS|MESSAGE_COMPLETED|RAW_COLUMNS):\s*(\d+)", result.stdout)}
    check(len(values) == 5, "GENERATED_OPERATIONS_DB_SCALARS")
    check(values["RAW_COLUMNS"] == 0 and values["NOTE_ROWS"] >= 1 and values["PULSE_EFFECTS"] == values["PULSE_RUNS"] >= 1 and values["MESSAGE_COMPLETED"] >= 1, "GENERATED_OPERATIONS_DB_EFFECTS")
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--consumer", required=True, type=pathlib.Path)
    parser.add_argument("--shared-home", type=pathlib.Path, default=ROOT / ".runtime/operations")
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--no-browser", action="store_true", help="API 전용 진단. 전체 검증 성공으로 표시하지 않는다.")
    parser.add_argument("--browser-only", action="store_true", help="수정된 UI 최종 검사. 기존 API 결과와 구분해 기록한다.")
    args = parser.parse_args()
    check(not (args.browser_only and args.no_browser), "GENERATED_OPERATIONS_MODE")
    # 브라우저 subprocess는 소비 앱 cwd에서 실행하므로 증거 경로를 먼저 고정한다.
    args.output = args.output.resolve()
    consumer = args.consumer.resolve(strict=True)
    check(not consumer.is_relative_to(ROOT) and not args.output.exists(), "GENERATED_OPERATIONS_NEW_EXTERNAL_FIXTURE")
    args.output.mkdir(parents=True)
    package = json.loads((consumer / "package.json").read_text())
    provenance = json.loads((consumer / "sc-starter.lock.json").read_text())
    check(package["version"] == "1.0.0" and provenance["templateVersion"] == 2 and provenance["frameworkVersion"] == "0.3.0", "GENERATED_OPERATIONS_COHORT")
    original = consumer / "backend/target" / (package["name"] + ".jar")
    report = {"stage": "012", "passed": False, "groups": [], "frameworkVersion": "0.3.0", "appVersion": "1.0.0", "originalRuntimeUsed": False, "manualReviewComplete": False, "browserExecuted": False}
    server = None
    canary = "SC_GENERATED_PRIVATE_CANARY_" + uuid.uuid4().hex

    def record(name, **details):
        report["groups"].append({"name": name, "passed": True, **details})
        print("PASS " + name, flush=True)

    try:
        with zipfile.ZipFile(original) as archive:
            check(not any("dev/scframework/reference" in name for name in archive.namelist()), "GENERATED_OPERATIONS_REFERENCE_CLASSES")
        server = operations_server("starter", port=0, management_port=free_port(), shared_home=args.shared_home)
        pinned = server.folder / "generated-consumer.jar"
        shutil.copyfile(original, pinned)
        server.jar = pinned
        server.extra_environment["SC_UPLOAD_ROOT"] = str(server.folder / "uploads")
        report["jarSha256"] = hashlib.sha256(pinned.read_bytes()).hexdigest()
        if args.browser_only:
            server.profile = "dev,operations"
            server.start()
            result = subprocess.run(["node", str(ROOT / "scripts/verify-generated-operations-browser.mjs"), "--consumer", str(consumer), "--base-url", server.base_url, "--secret-file", str(server.secret), "--output", str(args.output / "browser")], cwd=consumer, timeout=240)
            report["browserExecuted"] = True
            report["scope"] = "browser-only final repair verification; prior API evidence is separate"
            check(result.returncode == 0, "GENERATED_OPERATIONS_BROWSER")
            report["browser"] = json.loads((args.output / "browser/summary.json").read_text())
            record("installed-consumer-final-ui-and-safe-collector", browserGroups=len(report["browser"]["groups"]), axeScans=len(report["browser"]["axe"]))
            report["passed"] = True
        else:
            server.profile = "prod,operations"
            server.start()
            anonymous = HttpClient(server)
            anonymous.request("/api/notes", expected=401)
            anonymous.request("/api/operations/jobs/schedules", expected=401)
            anonymous.request("/v3/api-docs", expected=401)
            client = HttpClient(server)
            client.login()
            client.request("/v3/api-docs", expected=403)
            check(client.request("/api/auth/me") == {"username": "admin", "roles": ["ADMIN"]}, "GENERATED_OPERATIONS_IDENTITY")
            check(client.request("/api/framework/capabilities") == {"messaging": True, "scheduler": True, "browserErrors": True, "observability": True}, "GENERATED_OPERATIONS_CAPABILITIES")
            record("prod-selected-profile-session-and-swagger-boundaries", referenceClasses=0, capabilities=4)

            client.request("/api/notes", "POST", {"title": "csrf denied"}, expected=403, csrf=False)
            first = client.request("/api/notes", "POST", {"title": "운영 소비 앱_%!"})
            note_id = first["item"]["id"]
            check(first["item"]["revision"] == 1 and first["stats"]["total"] == 1, "GENERATED_OPERATIONS_NOTE_INSERT")
            second = client.request(f"/api/notes/{note_id}", "PUT", {"title": "운영 저장_%!", "revision": 1})
            check(second["item"]["revision"] == 2 and second["stats"]["highestRevision"] == 2, "GENERATED_OPERATIONS_MIXED_READ")
            stale = client.request(f"/api/notes/{note_id}", "PUT", {"title": "stale", "revision": 1}, expected=409)
            check(stale["code"] == "REVISION_CONFLICT" and client.request("/api/notes?q=" + urllib.parse.quote("_%!"))["total"] == 1, "GENERATED_OPERATIONS_REVISION_LITERAL")
            record("own-notes-jpa-querydsl-mybatis-flush-csrf-and-revision", noteRevision=2)

            registered = client.request("/api/operations/jobs/registered")["items"]
            check({row["jobCode"] for row in registered} == {"OUTBOX_DISPATCH", "FILE_RECOVERY", "SAFE_RETENTION", "PULSE"}, "GENERATED_OPERATIONS_REGISTERED")
            defaults = client.request("/api/operations/jobs/schedules?size=100")["items"]
            check({row["id"] for row in defaults} == {1, 2, 3}, "GENERATED_OPERATIONS_DEFAULTS")
            pulse = client.request("/api/operations/jobs/schedules", "POST", {"jobCode": "PULSE", "cron": "0 * * * * ?", "timeZone": "UTC", "misfirePolicy": "SKIP", "enabled": True})
            event = client.request("/api/operations/messages/demo", "POST", {}, expected=202)
            completed = wait(lambda: client.request("/api/operations/messages?size=100&type=MESSAGE_DEMO")["items"], lambda rows: any(row["eventId"] == event["eventId"] and row["state"] == "COMPLETED" for row in rows))
            check(len([row for row in completed if row["eventId"] == event["eventId"]]) == 1, "GENERATED_OPERATIONS_MESSAGE_SINGLE")
            runs = wait(lambda: client.request(f"/api/operations/jobs/runs?size=100&scheduleId={pulse['id']}")["items"], lambda rows: any(row["state"] == "SUCCESS" for row in rows))
            current = client.request(f"/api/operations/jobs/schedules/{pulse['id']}")
            paused = client.request(f"/api/operations/jobs/schedules/{pulse['id']}/pause", "POST", {"revision": current["revision"]})
            record("registered-four-default-three-real-message-and-minute-pulse", defaultSchedules=3, pulseSchedules=1, completedMessages=1, successfulPulseRuns=len([row for row in runs if row["state"] == "SUCCESS"]))

            base = {"schemaVersion": 1, "clientEventId": str(uuid.uuid4()), "source": "VUE", "eventCode": "VUE_ERROR", "appVersion": "1.0.0", "routeCode": "notes", "componentCode": "ROOT"}
            anonymous.request("/api/operations/browser-errors", "POST", base, expected=401)
            client.request("/api/operations/browser-errors", "POST", base, expected=403, csrf=False)
            client.request("/api/operations/browser-errors", "POST", {**base, "message": canary}, expected=400)
            client.request("/api/operations/browser-errors", "POST", {**base, "appVersion": "0.1.0"}, expected=400)
            client.request("/api/operations/browser-errors", "POST", {**base, "routeCode": "start"}, expected=400)
            client.request("/api/operations/browser-errors", "POST", base, expected=202)
            client.request("/api/operations/browser-errors", "POST", base, expected=202)
            client.request("/api/operations/browser-errors", "POST", {**base, "clientEventId": str(uuid.uuid4()), "routeCode": "patterns"}, expected=202)
            groups = client.request("/api/operations/browser-errors/groups?size=100")["items"]
            check(len(groups) == 2 and sum(row["occurrenceCount"] for row in groups) == 2 and {row["routeCode"] for row in groups} == {"notes", "patterns"}, "GENERATED_OPERATIONS_BROWSER_SAFE_RECEIPTS")
            check(canary not in json.dumps(groups), "GENERATED_OPERATIONS_BROWSER_RAW_LEAK")
            record("consumer-app-one-version-router-allowlist-receipts-and-auth", acceptedOccurrences=2, rejectedBoundaries=5)

            server.stop()
            server.profile = "dev,operations"
            server.start()
            client = HttpClient(server)
            client.login()
            schema = client.request("/v3/api-docs")
            paths = [name for name in schema["paths"] if name.startswith("/api/operations/") or name == "/api/framework/capabilities"]
            integer = schema["components"]["schemas"]["BrowserErrorInput"]["properties"]["schemaVersion"]
            check(len(paths) == 13 and integer.get("type") == "integer" and integer.get("enum") == [1], "GENERATED_OPERATIONS_ACTUAL_OPENAPI")
            check(client.request(f"/api/notes/{note_id}")["revision"] == 2, "GENERATED_OPERATIONS_RESTART_NOTE")
            restored = client.request(f"/api/operations/jobs/schedules/{pulse['id']}")
            check(restored["enabled"] is False and restored["revision"] == paused["revision"] and len(client.request("/api/operations/jobs/schedules?size=100")["items"]) == 4, "GENERATED_OPERATIONS_RESTART_SCHEDULE")
            check(len(client.request(f"/api/operations/jobs/runs?size=100&scheduleId={pulse['id']}")["items"]) == len(runs), "GENERATED_OPERATIONS_RESTART_RUNS")
            check(sum(row["occurrenceCount"] for row in client.request("/api/operations/browser-errors/groups?size=100")["items"]) == 2, "GENERATED_OPERATIONS_RESTART_BROWSER")
            record("same-h2-prod-to-dev-restart-and-actual-thirteen-openapi-paths", operationalPaths=13, numericSchemaVersion=1, schedules=4)

            if not args.no_browser:
                command = ["node", str(ROOT / "scripts/verify-generated-operations-browser.mjs"), "--consumer", str(consumer), "--base-url", server.base_url, "--secret-file", str(server.secret), "--output", str(args.output / "browser")]
                result = subprocess.run(command, cwd=consumer, timeout=240)
                report["browserExecuted"] = True
                check(result.returncode == 0, "GENERATED_OPERATIONS_BROWSER")
                report["browser"] = json.loads((args.output / "browser/summary.json").read_text())
                record("installed-consumer-ui-locale-viewports-whole-dom-axe-and-runtime-collector", browserGroups=len(report["browser"]["groups"]), axeScans=len(report["browser"]["axe"]))
            server.stop()
            report["database"] = inspect_database(server)
            record("stopped-private-h2-pulse-effects-outbox-and-safe-browser-columns", **report["database"])
            report["passed"] = not args.no_browser
    except Exception as error:
        report["failureType"] = type(error).__name__
        if isinstance(error, VerificationFailure):
            report["failureCode"] = str(error)
        print("FAIL generated operations verification (" + type(error).__name__ + ")", flush=True)
    finally:
        if server is not None:
            try:
                server.stop()
                forbidden = [server.password.encode(), canary.encode()]
                for name in ("spring.rabbitmq.password", "observer.secret"):
                    forbidden.append((server.folder / "secrets/operations" / name).read_bytes().strip())
                for file in server.folder.rglob("*"):
                    if file.is_file() and file.suffix in (".log", ".ndjson"):
                        check(not any(value and value in file.read_bytes() for value in forbidden), "GENERATED_OPERATIONS_PRIVATE_LOG_LEAK")
                record("private-process-and-event-logs-no-secret-or-raw-canary", secretMatches=0)
            except Exception as error:
                report["passed"] = False
                report["cleanupInspectionFailure"] = type(error).__name__
            finally:
                server.cleanup()
                report["temporaryRuntimeRemoved"] = not server.folder.exists()
        (args.output / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
