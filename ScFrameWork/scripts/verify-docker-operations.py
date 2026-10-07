#!/usr/bin/env python3
"""격리한 012 Compose Reference 앱만 변경하며 실제 운영 실행·재시작을 검증한다."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import uuid
from types import SimpleNamespace

from _harness import ROOT, HttpClient

DEFAULT_PROJECT = "scframework-012-20261007"
SERVICES = {"rabbitmq", "prometheus", "collector", "tempo", "loki", "grafana"}
JOBS = {"OUTBOX_DISPATCH", "FILE_RECOVERY", "SAFE_RETENTION", "PULSE"}


class GateFailure(RuntimeError):
    pass


def check(condition, code):
    if not condition:
        raise GateFailure(code)


def private_secret(path):
    check(path.is_file() and not path.is_symlink(), "SC_DOCKER_SECRET_FILE")
    check(stat.S_IMODE(path.stat().st_mode) == 0o600, "SC_DOCKER_SECRET_MODE")
    value = path.read_text(encoding="utf-8").strip()
    check(16 <= len(value.encode("utf-8")) <= 72, "SC_DOCKER_SECRET_LENGTH")
    return value


def wait_for(read, accept, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = read()
            if accept(value):
                return value
        except (OSError, ValueError, AssertionError):
            pass
        time.sleep(0.5)
    raise GateFailure("SC_DOCKER_READY_TIMEOUT")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=DEFAULT_PROJECT)
    parser.add_argument("--operations-home", type=pathlib.Path, default=ROOT / ".runtime/operations")
    parser.add_argument("--docker-config", type=pathlib.Path)
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "docs/검증/012-docker-operations-first.json")
    parser.add_argument("--log", type=pathlib.Path, default=ROOT / "docs/검증/012-docker-operations-first.log")
    # Prometheus configuration changes are owned by the parent; this gate may wait for its recreation.
    parser.add_argument("--prometheus-timeout", type=int, default=90)
    args = parser.parse_args()
    check(re.fullmatch(r"scframework-012-[a-z0-9-]{1,40}", args.project), "SC_DOCKER_PROJECT_ALLOWLIST")
    check(5 <= args.prometheus_timeout <= 180, "SC_DOCKER_TIMEOUT_BOUND")
    project = args.project
    docker = shutil.which("docker")
    environment = dict(os.environ)
    home = args.operations_home.absolute()
    temporary_docker_config = None
    config_path = args.docker_config
    if config_path is None and environment.get("DOCKER_CONFIG"):
        config_path = pathlib.Path(environment["DOCKER_CONFIG"])
    if config_path is None and environment.get("GITHUB_ACTIONS") == "true":
        temporary_docker_config = pathlib.Path(tempfile.mkdtemp(prefix="sc-012-docker-config-")).resolve()
        temporary_docker_config.chmod(0o700)
        config_path = temporary_docker_config
    if config_path is not None:
        config_path = config_path.absolute()
        check(config_path == config_path.resolve() and config_path.is_dir()
              and stat.S_IMODE(config_path.stat().st_mode) == 0o700, "SC_DOCKER_PRIVATE_CONFIG")
        environment["DOCKER_CONFIG"] = str(config_path)
    # DOCKER_HOST is inherited only when explicitly supplied; otherwise the selected context is used.
    environment["SC_OPERATIONS_HOME"] = str(home)
    checks = []
    phase = "private task project configuration"
    failed = False
    secrets = []
    infra_before = {}
    application = None
    initial_application_id = None
    restarted_application_id = None
    marker = "docker-012-" + uuid.uuid4().hex[:12]
    started = time.monotonic()

    def command(arguments, *, input_bytes=None, timeout=90):
        result = subprocess.run([docker, *arguments], cwd=ROOT, env=environment,
                                input=input_bytes, capture_output=True, timeout=timeout)
        # Docker errors/configuration remain memory-only; they may include secret file paths.
        check(result.returncode == 0, "SC_DOCKER_COMMAND_FAILED")
        return result.stdout

    def compose(*arguments, timeout=90):
        return command(["compose", "-p", project, "-f", "compose.operations.yaml",
                        "--profile", "app", *arguments], timeout=timeout)

    def inspect(container):
        values = json.loads(command(["inspect", container]))
        check(len(values) == 1, "SC_DOCKER_INSPECT_SINGLE")
        value = values[0]
        labels = value["Config"].get("Labels") or {}
        check(labels.get("com.docker.compose.project") == project, "SC_DOCKER_PROJECT_BOUNDARY")
        return value

    def service_ids():
        ids = command(["ps", "--filter", "label=com.docker.compose.project=" + project,
                       "--format", "{{.ID}}"]).decode().split()
        result = {}
        for container in ids:
            value = inspect(container)
            name = value["Config"]["Labels"].get("com.docker.compose.service")
            if name in SERVICES:
                result[name] = value["Id"]
        return result

    def app_exec(arguments, *, input_bytes=None):
        check(application is not None, "SC_DOCKER_APP_REQUIRED")
        return command(["exec", *( ["-i"] if input_bytes is not None else []), application,
                        *arguments], input_bytes=input_bytes)

    def passed(name, **metadata):
        checks.append({"name": name, "passed": True, **metadata})
        print("PASS " + name, flush=True)

    def app_metadata():
        value = inspect(application)
        check(value["Config"]["Labels"].get("com.docker.compose.service") == "reference-app",
              "SC_DOCKER_APP_SERVICE")
        ports = value["NetworkSettings"]["Ports"].get("18082/tcp")
        check(ports == [{"HostIp": "127.0.0.1", "HostPort": "19082"}], "SC_DOCKER_LOOPBACK_PORT")
        env = dict(entry.split("=", 1) for entry in value["Config"]["Env"] if "=" in entry)
        check(env.get("SC_PROFILE") == "prod,operations", "SC_DOCKER_PROFILE")
        check(env.get("SC_HOME") == "/app/runtime" and env.get("SC_UPLOAD_DIR") == "/app/runtime/uploads",
              "SC_DOCKER_RUNTIME_PATH")
        volume = [item for item in value["Mounts"] if item["Destination"] == "/app/runtime"]
        check(len(volume) == 1 and volume[0]["Type"] == "volume"
              and volume[0]["Name"] == project + "_operations-application", "SC_DOCKER_NAMED_VOLUME")
        for target in ("/run/secrets/bootstrap_secret", "/run/secrets/broker_secret", "/run/secrets/observer_secret"):
            mounted = [item for item in value["Mounts"] if item["Destination"] == target]
            check(len(mounted) == 1 and not mounted[0]["RW"], "SC_DOCKER_SECRET_MOUNT")
        return value

    def private_runtime():
        identity = app_exec(["sh", "-c", "awk '/^Uid:|^Gid:|^Umask:/{print}' /proc/1/status"]).decode()
        uid = re.search(r"^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$", identity, re.MULTILINE)
        gid = re.search(r"^Gid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$", identity, re.MULTILINE)
        check(uid and gid and set(uid.groups()) == {"10001"} and set(gid.groups()) == {"10001"},
              "SC_DOCKER_NON_ROOT_PROCESS")
        check(re.search(r"^Umask:\s+0077$", identity, re.MULTILINE), "SC_DOCKER_UMASK")
        for path in ("/app/runtime", "/app/runtime/data", "/app/runtime/uploads", "/app/runtime/logs",
                     "/run/sc-secret", "/run/sc-operations"):
            actual = app_exec(["stat", "-c", "%u %g %a", path]).decode().strip()
            check(actual == "10001 10001 700", "SC_DOCKER_PRIVATE_DIRECTORY")
        for path in ("/run/sc-secret/bootstrap.secret", "/run/sc-operations/spring.rabbitmq.password",
                     "/run/sc-operations/observer.secret", "/app/runtime/.sc-runtime.lock",
                     "/app/runtime/data/sc-reference.mv.db"):
            actual = app_exec(["stat", "-c", "%u %g %a", path]).decode().strip()
            check(actual == "10001 10001 600", "SC_DOCKER_PRIVATE_FILE")

    def safe_logs():
        content = command(["logs", application]) + app_exec(["cat", "/app/runtime/logs/application.log"])
        check(all(value.encode() not in content for value in secrets), "SC_DOCKER_SECRET_LOG_LEAK")
        return content.decode(errors="replace")

    try:
        check(docker is not None, "SC_DOCKER_CLI")
        check(home == home.resolve() and not any(parent.is_symlink() for parent in (home, *home.parents)),
              "SC_DOCKER_HOME_LINK")
        original_roots = (pathlib.Path("/Users/dk/Work/WorkboardVue"), pathlib.Path("/Users/dk/Work/workboard"))
        check(not any(home == item or item in home.parents for item in original_roots), "SC_DOCKER_ORIGINAL_ROOT")
        for folder in (home, home / "secrets", home / "secrets/operations"):
            check(folder.is_dir() and stat.S_IMODE(folder.stat().st_mode) == 0o700, "SC_DOCKER_HOME_PRIVATE")
        password = private_secret(home / "secrets/bootstrap.secret")
        broker_password = private_secret(home / "secrets/operations/spring.rabbitmq.password")
        observer_password = private_secret(home / "secrets/operations/observer.secret")
        secrets.extend((password, broker_password, observer_password))
        infra_before = service_ids()
        check(set(infra_before) == SERVICES, "SC_DOCKER_INFRA_REQUIRED")
        config = json.loads(compose("config", "--format", "json"))
        service = config["services"]["reference-app"]
        check(set(service["secrets"][index]["source"] for index in range(len(service["secrets"])))
              == {"bootstrap_secret", "broker_secret", "observer_secret"}, "SC_DOCKER_SECRET_CONFIG")
        check(config["secrets"]["bootstrap_secret"]["file"] == str(home / "secrets/bootstrap.secret"),
              "SC_DOCKER_BOOTSTRAP_SOURCE")
        passed("private Compose project/named runtime volume/read-only secret configuration", infraServices=6)

        phase = "start task Reference app with private non-root runtime"
        compose("up", "-d", "--no-deps", "reference-app", timeout=120)
        ids = compose("ps", "-q", "reference-app").decode().split()
        check(len(ids) == 1, "SC_DOCKER_APP_SINGLE")
        application = ids[0]
        metadata = app_metadata()
        initial_application_id = metadata["Id"]
        server = SimpleNamespace(base_url="http://127.0.0.1:19082", password=password)
        wait_for(lambda: HttpClient(server).request("/api/health"), lambda item: item.get("status") == "UP", 120)
        private_runtime()
        logs = safe_logs()
        check(re.search(r"(?:Successfully validated 7 migrations|Successfully applied 7 migrations)", logs),
              "SC_DOCKER_SEVEN_MIGRATIONS")
        passed("actual prod operations/loopback/UID10001/umask077/private600/700/Flyway7", port=19082,
               uid=10001, umask="0077", migrations=7, uploads="/app/runtime/uploads")

        phase = "actual session CSRF/capabilities/messages/registered jobs"
        anonymous = HttpClient(server)
        anonymous.request("/api/operations/messages", expected=401)
        admin = HttpClient(server)
        admin.login()
        identity = admin.request("/api/auth/me")
        check(identity.get("role") == "ADMIN", "SC_DOCKER_DB_ADMIN")
        capabilities = admin.request("/api/framework/capabilities")
        check(capabilities == {"messaging": True, "scheduler": True, "browserErrors": True, "observability": True},
              "SC_DOCKER_CAPABILITIES")
        denied = admin.request("/api/operations/messages/demo", "POST", {}, expected=403, csrf=False)
        check(denied.get("code") == "CSRF", "SC_DOCKER_CSRF")
        demo = admin.request("/api/operations/messages/demo", "POST", {}, expected=202)
        event_id = demo["eventId"]
        def read_demo():
            items = admin.request("/api/operations/messages?type=MESSAGE_DEMO&size=100")["items"]
            return next((item for item in items if item["eventId"] == event_id), {})
        completed = wait_for(read_demo, lambda item: item.get("state") == "COMPLETED")
        check("payload" not in completed and "failure" not in completed, "SC_DOCKER_REDACTED_MESSAGE")
        registered = admin.request("/api/operations/jobs/registered")["items"]
        check({item["jobCode"] for item in registered} == JOBS and len(registered) == 4, "SC_DOCKER_REGISTERED_JOBS")
        passed("database ADMIN/session/CSRF/four capabilities/MESSAGE_DEMO completed/four registered tasks",
               capabilities=4, registeredTasks=4, messageState="COMPLETED")

        phase = "PULSE schedule create/pause/revision conflict"
        existing = admin.request("/api/operations/jobs/schedules?size=100")["items"]
        pulse = next((item for item in existing if item["jobCode"] == "PULSE"), None)
        if pulse is None:
            pulse = admin.request("/api/operations/jobs/schedules", "POST",
                                  {"jobCode": "PULSE", "cron": "0 * * * * ?", "timeZone": "UTC",
                                   "misfirePolicy": "SKIP", "enabled": True})
        elif not pulse["enabled"]:
            pulse = admin.request(f'/api/operations/jobs/schedules/{pulse["id"]}/resume', "POST",
                                  {"revision": pulse["revision"]})
        before_revision = pulse["revision"]
        paused = admin.request(f'/api/operations/jobs/schedules/{pulse["id"]}/pause', "POST",
                               {"revision": before_revision})
        check(paused["enabled"] is False and paused["revision"] == before_revision + 1, "SC_DOCKER_SCHEDULE_PAUSE")
        conflict = admin.request(f'/api/operations/jobs/schedules/{pulse["id"]}/resume', "POST",
                                 {"revision": before_revision}, expected=409)
        check(conflict.get("code") == "REVISION_CONFLICT", "SC_DOCKER_SCHEDULE_CAS")
        passed("registered PULSE create/pause and stale revision409", revision=paused["revision"])

        phase = "synthetic requirement/PDF writes into the mounted runtime"
        spec = importlib.util.spec_from_file_location("sc_docker_media", ROOT / "scripts/verify-reference-media.py")
        media = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(media)
        menu = admin.request("/api/menus", "POST", {"name": marker, "sortOrder": 0})
        requirement = admin.request("/api/requirements", "POST",
                                    {"title": marker, "menuId": menu["id"], "desired": "Synthetic Docker persistence",
                                     "reason": "Synthetic fixture", "referenceText": "", "similar": False,
                                     "followParts": "", "screenVersionId": None, "annotation": None, "revision": 1})
        pdf = media.synthetic_pdf()
        before = media.upload(admin, f'/api/requirements/{requirement["id"]}/attachments?revision=1',
                              pdf, "docker-fixture.pdf", "application/pdf")
        check(before["revision"] == 2 and len(before["attachments"]) == 1, "SC_DOCKER_ATTACHMENT")
        file_id = before["attachments"][0]["fileId"]
        check(media.raw(admin, f"/api/files/{file_id}")[0] == pdf, "SC_DOCKER_PDF_BYTES")
        blobs = app_exec(["find", "/app/runtime/uploads", "-maxdepth", "1", "-type", "f", "-name", "????????-????-????-????-????????????", "-print"]).decode().splitlines()
        check(len(blobs) >= 1 and all(re.fullmatch(r"/app/runtime/uploads/[0-9a-f-]{36}", item) for item in blobs),
              "SC_DOCKER_UPLOAD_MOUNT")
        passed("synthetic requirement revision2/PDF originals use durable application volume", revision=2,
               pdfSha256=hashlib.sha256(pdf).hexdigest())

        phase = "only Reference container restarts and H2/metadata/bytes/schedules persist"
        safe_logs()
        compose("restart", "reference-app", timeout=100)
        restarted = inspect(application)
        restarted_application_id = restarted["Id"]
        check(restarted_application_id == initial_application_id, "SC_DOCKER_RESTART_CONTAINER")
        phase = "Reference restart health readiness"
        wait_for(lambda: HttpClient(server).request("/api/health"), lambda item: item.get("status") == "UP", 120)
        admin = HttpClient(server)
        phase = "Reference restart new session and CSRF authentication"
        admin.login()
        phase = "Reference restart requirement detail and PDF bytes"
        check(admin.request(f'/api/requirements/{requirement["id"]}') == before, "SC_DOCKER_REQUIREMENT_RESTART")
        check(media.raw(admin, f"/api/files/{file_id}")[0] == pdf, "SC_DOCKER_BYTES_RESTART")
        phase = "Reference restart stored schedule and completed inbox"
        check(admin.request(f'/api/operations/jobs/schedules/{paused["id"]}') == paused, "SC_DOCKER_SCHEDULE_RESTART")
        check(read_demo()["state"] == "COMPLETED", "SC_DOCKER_INBOX_RESTART")
        private_runtime()
        safe_logs()
        check(service_ids() == infra_before, "SC_DOCKER_UNRELATED_INFRA_MUTATION")
        passed("Reference-only restart preserves H2 detail/revision/PDF/schedule/inbox with unchanged six infra IDs",
               revision=2, scheduleRevision=paused["revision"], infraContainersUnchanged=6)

        phase = "private observer authentication and actual Prometheus container scrape"
        status = app_exec(["curl", "--silent", "--output", "/dev/null", "--write-out", "%{http_code}",
                           "http://127.0.0.1:18482/actuator/prometheus"]).decode()
        check(status == "401", "SC_DOCKER_OBSERVER_UNAUTHENTICATED")
        credential = base64.b64encode(("sc-observer:" + observer_password).encode()).decode()
        configuration = ('header = "Authorization: Basic ' + credential + '"\nurl = "http://127.0.0.1:18482/actuator/prometheus"\n').encode()
        status = app_exec(["curl", "--config", "-", "--silent", "--output", "/dev/null", "--write-out", "%{http_code}"],
                          input_bytes=configuration).decode()
        check(status == "200", "SC_DOCKER_OBSERVER_AUTHENTICATED")
        def prometheus_up():
            url = "http://127.0.0.1:19090/api/v1/query?query=" + urllib.parse.quote('up{job="sc-framework-container"}')
            with urllib.request.urlopen(url, timeout=10) as response:
                content = json.load(response)
            return content.get("data", {}).get("result", [])
        scraped = wait_for(prometheus_up, lambda values: len(values) == 1 and values[0].get("value", [None, "0"])[1] == "1",
                           args.prometheus_timeout)
        check(scraped[0]["metric"].get("instance") == "reference-app:18482", "SC_DOCKER_PROMETHEUS_TARGET")
        safe_logs()
        passed("management Basic observer401/200 and actual Prometheus container job UP", unauthenticated=401,
               authenticated=200, prometheusJob="sc-framework-container", scrapeUp=1)
    except Exception as error:
        failed = True
        code = str(error) if isinstance(error, GateFailure) else "SC_DOCKER_VALIDATION_FAILED"
        failure = {"name": phase, "passed": False, "code": code, "exceptionType": type(error).__name__}
        if isinstance(error, AssertionError):
            status = re.search(r"HTTP (\d{3}) 대신 (\d{3})", str(error))
            if status:
                failure["expectedHttpStatus"], failure["actualHttpStatus"] = map(int, status.groups())
        checks.append(failure)
        print("FAIL " + phase + " (" + code + ")", flush=True)
    finally:
        # Keep only this delegated application's durable synthetic data for parent evidence/cleanup.
        report = {"stage": "012", "passed": not failed, "groups": sum(item["passed"] for item in checks),
                  "checks": checks, "elapsedSeconds": round(time.monotonic() - started, 3),
                  "project": project, "applicationService": "reference-app", "originalRuntimeUsed": False,
                  "syntheticFixturesOnly": True, "mutatedServices": ["reference-app"],
                  "applicationKeptRunning": application is not None, "taskVolumeKeptForParent": True,
                  "secretValuesPrinted": False, "rawDockerConfigOrLogsSaved": False,
                  "remoteExecution": False, "scope": "local Docker image/production operations/private runtime/clean restart; no power-loss guarantee"}
        if temporary_docker_config is not None:
            shutil.rmtree(temporary_docker_config)
            report["temporaryDockerConfigRemoved"] = not temporary_docker_config.exists()
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text("\n".join(("PASS " if item["passed"] else "FAIL ") + item["name"] for item in checks) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
