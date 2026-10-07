#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""생성 앱의 실제 JAR/선택 프로필/실행 스크립트를 새 자료에서만 확인한다."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import secrets
import shutil
import socket
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

from _harness import ROOT, HttpClient


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def listening(port):
    with socket.socket() as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def java_binary():
    supplied = os.environ.get("JAVA_BIN")
    if not supplied and os.environ.get("JAVA21_HOME"):
        supplied = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
    if not supplied and pathlib.Path("/usr/libexec/java_home").is_file():
        result = subprocess.run(["/usr/libexec/java_home", "-v", "21"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            supplied = str(pathlib.Path(result.stdout.strip()) / "bin/java")
    value = str(pathlib.Path(shutil.which(supplied or "java") or supplied or "java").resolve())
    result = subprocess.run([value, "-version"], capture_output=True, text=True, timeout=10)
    check(result.returncode == 0 and re.search(r'version "21(?:\.|\")', result.stderr + result.stdout), "JDK21 is required")
    return value


def environment(java, home, jar, profile=None, port=0):
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(("APP_", "WORKBOARD_", "SC_", "SPRING_", "SERVER_", "LOGGING_", "MANAGEMENT_", "VITE_"))
           and key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "JAVA21_HOME", "JAVA_HOME")}
    env.update(JAVA_BIN=java, SC_HOME=str(home), SC_APP_JAR=str(jar), SC_PORT=str(port), SC_ADDRESS="127.0.0.1", SC_BOOTSTRAP_USERNAME="admin")
    if profile is not None:
        env["SC_PROFILE"] = profile
    return env


def command_line(pid):
    result = subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True, timeout=5)
    return result.stdout.strip()


class GeneratedServer:
    def __init__(self, app, jar, java, profile=None):
        self.app, self.jar, self.java, self.profile = app, jar, java, profile
        self.folder = pathlib.Path(tempfile.mkdtemp(prefix="sc-generated-features-", dir=pathlib.Path(tempfile.gettempdir()).resolve()))
        self.folder.chmod(0o700)
        self.secret = self.folder / "secrets/bootstrap.secret"
        self.password = None
        self.process = None
        self.log = None
        self.port = 0
        self.run_pid = None
        self.child_pid = None
        self.base_url = None
        self.logs = []
        self.counter = 0

    def start(self, dev=False, frontend_port=None):
        check(self.process is None, "Fixture already running")
        self.counter += 1
        log_path = self.folder / f"launcher-{self.counter}.log"
        self.log = log_path.open("wb")
        self.logs.append(log_path)
        port = free_port() if dev else 0
        env = environment(self.java, self.folder, self.jar, self.profile, port)
        script = self.app / ("scripts/dev.sh" if dev else "scripts/run.sh")
        self.process = subprocess.Popen(["bash", str(script)], cwd=self.folder, env=env, stdout=self.log, stderr=self.log)
        deadline = time.monotonic() + 90
        ready = False
        while time.monotonic() < deadline:
            check(self.process.poll() is None, "Generated launcher exited before readiness")
            match = re.search(r"Tomcat started on port (\d+)", log_path.read_text(errors="replace"))
            if match:
                self.port = int(match.group(1))
                self.base_url = f"http://127.0.0.1:{self.port}"
                try:
                    ready = HttpClient(self).request("/api/health").get("status") == "UP"
                except (OSError, ValueError, AssertionError):
                    ready = False
                if ready and (not dev or listening(frontend_port)):
                    break
            time.sleep(0.2)
        check(ready and (not dev or listening(frontend_port)), "Generated app readiness timed out")
        check(self.secret.is_file() and not self.secret.is_symlink() and stat.S_IMODE(self.secret.stat().st_mode) == 0o600, "Generated secret is not an owned mode600 regular file")
        check(self.secret.stat().st_uid == os.getuid(), "Generated secret owner differs")
        self.password = self.secret.read_text()
        check(16 <= len(self.password.encode()) <= 72, "Generated secret byte length is invalid")
        self.run_pid = int((self.folder / "app.pid").read_text().strip())
        check(str(self.app / "scripts/run.sh") in command_line(self.run_pid), "PID does not identify this generated app run.sh")
        if not dev:
            check(self.run_pid == self.process.pid, "run.sh PID differs from managed launcher")
        children = subprocess.run(["ps", "-axo", "pid=,ppid="], capture_output=True, text=True, timeout=5)
        check(children.returncode == 0, "Process parent inspection failed")
        candidates = [int(parts[0]) for line in children.stdout.splitlines()
                      if len(parts := line.split()) == 2 and all(part.isdigit() for part in parts)
                      and int(parts[1]) == self.run_pid]
        java_children = [pid for pid in candidates if str(self.jar) in command_line(pid)]
        check(len(java_children) == 1, "Launcher does not own exactly one selected JAR child")
        self.child_pid = java_children[0]
        return HttpClient(self)

    def stop(self, helper=False, frontend_port=None):
        check(self.process is not None, "Fixture is not running")
        process = self.process
        if helper:
            stopper = subprocess.Popen(["bash", str(self.app / "scripts/stop.sh")], cwd=self.folder,
                                       env=environment(self.java, self.folder, self.jar), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            deadline = time.monotonic() + 20
            while stopper.poll() is None and time.monotonic() < deadline:
                process.poll()  # 부모가 종료한 child를 회수해야 stop.sh의 kill -0가 zombie를 보지 않는다.
                time.sleep(0.05)
            out, err = stopper.communicate(timeout=5)
            check(stopper.returncode == 0, "Generated stop.sh failed to stop its owned launcher")
            check(not self.password or self.password.encode() not in out + err, "Secret appeared in stop helper output")
        else:
            process.terminate()
        process.wait(timeout=40)
        check(process.returncode == 143, "Generated launcher did not handle TERM")
        self.process = None
        self.log.close()
        self.log = None
        check(not (self.folder / "app.pid").exists(), "Generated launcher left its PID file")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if not command_line(self.child_pid) and not listening(self.port) and (frontend_port is None or not listening(frontend_port)):
                return
            time.sleep(0.1)
        raise AssertionError("Generated launcher left Java/Vite or an open port")

    def cleanup(self):
        if self.process is not None:
            try:
                self.stop()
            except Exception:
                # 자신의 기록된 child만 정리한다. 임의 PID는 종료하지 않는다.
                for pid in (self.child_pid, self.run_pid):
                    if pid and str(self.app) in command_line(pid):
                        try:
                            os.kill(pid, 15)
                        except ProcessLookupError:
                            pass
                if self.process.poll() is None:
                    self.process.kill()
                self.process.wait(timeout=10)
                self.process = None
                if self.log:
                    self.log.close()
                    self.log = None


class H2Counts:
    def __init__(self, server):
        self.server = server
        self.driver = server.folder / "inspection-h2.jar"
        with zipfile.ZipFile(server.jar) as archive:
            names = [name for name in archive.namelist() if re.fullmatch(r"BOOT-INF/lib/h2-[^/]+\.jar", name)]
            check(len(names) == 1, "Generated JAR must contain one H2 driver")
            self.driver.write_bytes(archive.read(names[0]))

    def read(self, queries):
        check(self.server.process is None, "H2 inspection requires stopped app")
        sql = "SELECT " + ",".join(f"({query}) AS {name}" for name, query in queries.items()) + ";"
        result = subprocess.run([self.server.java, "-cp", str(self.driver), "org.h2.tools.Shell", "-url",
                                 f"jdbc:h2:file:{self.server.folder / 'data/app'};IFEXISTS=TRUE;ACCESS_MODE_DATA=r",
                                 "-user", "sa", "-password", "", "-properties", "null", "-list", "-sql", sql],
                                cwd=self.server.folder, capture_output=True, text=True, timeout=20)
        check(result.returncode == 0 and "Error:" not in result.stdout and not result.stderr.strip(), "Private H2 count inspection failed")
        values = {name: int(value) for name, value in re.findall(r"(?m)^([A-Z_]+)\s*:\s*(\d+)\s*$", result.stdout)}
        check(set(values) == set(queries), "Private H2 count result shape differs")
        return values

    def schema(self, audit):
        values = self.read({
            "TABLES": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'",
            "NOTES": "SELECT COUNT(*) FROM STARTER_NOTE",
            "AUDIT": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='SECURITY_AUDIT_EVENT'",
            "REFERENCE": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME IN ('APP_USER','REQUIREMENT','KANBAN_TASK','DOCUMENT','NOTICE')",
            "MIGRATIONS": 'SELECT COUNT(*) FROM "flyway_schema_history" WHERE "version" IS NOT NULL AND "success"=TRUE',
        })
        check(values == {"TABLES": 3 if audit else 2, "NOTES": 1, "AUDIT": int(audit), "REFERENCE": 0, "MIGRATIONS": 2 if audit else 1}, "Generated app schema/profile ownership differs")
        return values

    def events(self):
        return self.read({
            "TOTAL": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT",
            "LOGIN": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE action='AUTH_LOGIN' AND outcome='SUCCESS' AND actor_subject='admin'",
            "CREATE": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE action='NOTE_CREATE' AND outcome='SUCCESS' AND actor_subject='admin' AND resource_type='NOTE' AND resource_id IS NOT NULL",
            "UPDATE": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE action='NOTE_UPDATE' AND outcome='SUCCESS' AND actor_subject='admin' AND resource_type='NOTE' AND resource_id IS NOT NULL",
            "UNEXPECTED_NOTE": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE resource_type='NOTE' AND (actor_id IS NOT NULL OR outcome<>'SUCCESS' OR reason_code IS NOT NULL)",
        })


def multipart(client, payload, expected=200, csrf=True):
    boundary = "sc-generated-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
            + payload + f"\r\n--{boundary}--\r\n".encode())
    headers = {"Content-Type": "multipart/form-data; boundary=" + boundary}
    if csrf:
        if client.csrf is None:
            client.csrf = client.request("/api/auth/csrf")
        headers[client.csrf["headerName"]] = client.csrf["token"]
    request = urllib.request.Request(client.server.base_url + "/api/storage-demo", data=body, headers=headers, method="POST")
    try:
        response = client.opener.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        status, content = response.status, response.read()
    check(status == expected, "Storage multipart response status differs")
    return json.loads(content)


def notes_flow(client):
    check(client.request("/api/auth/me", expected=401).get("code") == "AUTH_REQUIRED", "Anonymous identity was accepted")
    client.login()
    check(client.request("/api/auth/me") == {"username": "admin", "roles": ["ADMIN"]}, "Generated default identity shape changed")
    client.request("/api/notes", "POST", {"title": "synthetic no csrf"}, expected=403, csrf=False)
    result = client.request("/api/notes", "POST", {"title": "synthetic generated feature"})
    check(result["item"]["revision"] == 1 and result["stats"]["total"] == 1, "Notes JPA/MyBatis create aggregate differs")
    identifier = result["item"]["id"]
    updated = client.request(f"/api/notes/{identifier}", "PUT", {"title": "synthetic changed", "revision": 1})
    check(updated["item"]["revision"] == 2 and updated["stats"]["highestRevision"] == 2, "Notes revision/aggregate update differs")
    client.request(f"/api/notes/{identifier}", "PUT", {"title": "synthetic stale", "revision": 1}, expected=409)
    check(client.request(f"/api/notes/{identifier}")["title"] == "synthetic changed", "Stale update changed saved data")
    return identifier


def swagger(client, enabled, storage):
    if enabled:
        document = client.request("/v3/api-docs")
        check(document.get("openapi", "").startswith("3."), "dev profile did not expose live Swagger")
        check(("/api/storage-demo" in document["paths"]) == storage, "Swagger storage profile differs")
    else:
        client.request("/v3/api-docs", expected=403)


def profile_flow(server, audit, storage):
    client = server.start()
    identifier = notes_flow(client)
    swagger(client, "dev" in (server.profile or "").split(","), storage)
    retained = None
    payload = b"synthetic-generated-storage\x00\xff\r\n"
    if storage:
        multipart(client, payload, expected=403, csrf=False)
        multipart(client, b"", expected=400)
        entry = multipart(client, payload)
        check(set(entry) == {"key", "size"} and entry["size"] == len(payload), "Storage metadata shape differs")
        check(str(uuid.UUID(entry["key"])) == entry["key"], "Storage key is not opaque UUID")
        stored = server.folder / "uploads" / entry["key"]
        check(stored.read_bytes() == payload, "Storage physical bytes differ")
        check(client.request("/api/storage-demo/" + entry["key"]) == payload, "Storage download differs")
        client.request("/api/storage-demo/" + entry["key"], "DELETE", expected=204)
        check(not stored.exists(), "Explicit storage delete retained physical bytes")
        retained = multipart(client, payload)["key"]
    else:
        client.request("/api/storage-demo/" + str(uuid.uuid4()), expected=404)
        check(not list((server.folder / "uploads").iterdir()), "Disabled storage wrote bytes")
    first_secret = server.password
    server.stop(helper=True)
    if retained:
        check(not (server.folder / "uploads" / retained).exists(), "Clean shutdown retained its current-run registered file")
        # 이전 실행 bytes를 자기 root에 합성해도 새 controller metadata에 등록되지 않아야 한다.
        (server.folder / "uploads" / retained).write_bytes(payload)
    inspector = H2Counts(server)
    schema = inspector.schema(audit)
    before = inspector.events() if audit else None
    if audit:
        check(before["LOGIN"] == 1 and before["CREATE"] == 1 and before["UPDATE"] == 1 and before["UNEXPECTED_NOTE"] == 0, "Committed Notes/security audit differs")
    restarted = server.start()
    check(server.password == first_secret, "Restart replaced its owned secret")
    restarted.login()
    item = restarted.request(f"/api/notes/{identifier}")
    check(item["revision"] == 2 and item["title"] == "synthetic changed", "Restart lost Notes data")
    if retained:
        restarted.request("/api/storage-demo/" + retained, expected=404)
        check((server.folder / "uploads" / retained).read_bytes() == payload, "Restart altered unregistered physical bytes")
    server.stop()
    inspector.schema(audit)
    after = inspector.events() if audit else None
    if audit:
        check(after["CREATE"] == before["CREATE"] and after["UPDATE"] == before["UPDATE"] and after["LOGIN"] == before["LOGIN"] + 1 and after["TOTAL"] >= before["TOTAL"] + 1, "Restart lost or duplicated committed audit")
    if retained:
        check((server.folder / "uploads" / retained).read_bytes() == payload, "Clean stop deleted an unregistered file")
    return {"schema": schema, "auditCountsBefore": before, "auditCountsAfter": after, "storageBytes": len(payload) if storage else 0, "restartPreservedNotes": True, "restartMetadataWhitelist": storage, "normalShutdownOnly": True}


def reject_and_pid_flow(app, jar, java, parent):
    folder = parent / "rejections"
    folder.mkdir()
    env = environment(java, folder, jar, "dev,invalid")
    result = subprocess.run(["bash", str(app / "scripts/run.sh")], cwd=folder, env=env, capture_output=True, timeout=15)
    check(result.returncode != 0 and not list(folder.iterdir()), "Invalid profile created runtime or started")
    secret = folder / "bad.secret"
    secret.write_text(secrets.token_urlsafe(24))
    secret.chmod(0o644)
    env = environment(java, folder, jar, "prod")
    env["SC_BOOTSTRAP_SECRET_FILE"] = str(secret)
    result = subprocess.run(["bash", str(app / "scripts/run.sh")], cwd=folder, env=env, capture_output=True, timeout=15)
    check(result.returncode != 0 and not (folder / "app.pid").exists(), "Non600 secret started a launcher")
    check(secret.read_bytes() not in result.stdout + result.stderr, "Bad secret was printed")
    dummy = subprocess.Popen(["sleep", "60"])
    try:
        pid = folder / "app.pid"
        pid.write_text(str(dummy.pid))
        result = subprocess.run(["bash", str(app / "scripts/stop.sh")], cwd=folder, env=env, capture_output=True, timeout=15)
        check(result.returncode != 0 and dummy.poll() is None and pid.read_text() == str(dummy.pid), "stop.sh terminated an unrelated process")
        pid.write_text("not-a-pid")
        result = subprocess.run(["bash", str(app / "scripts/stop.sh")], cwd=folder, env=env, capture_output=True, timeout=15)
        check(result.returncode != 0 and dummy.poll() is None, "Malformed PID was accepted")
        pid.unlink()
        target = folder / "target.pid"
        target.write_text(str(dummy.pid))
        pid.symlink_to(target)
        result = subprocess.run(["bash", str(app / "scripts/stop.sh")], cwd=folder, env=env, capture_output=True, timeout=15)
        check(result.returncode == 0 and dummy.poll() is None and pid.is_symlink(), "Symlink PID was followed or deleted")
    finally:
        dummy.terminate()
        dummy.wait(timeout=10)
    return {"invalidProfileRejected": True, "non600SecretRejected": True, "unrelatedPidPreserved": True, "malformedPidRejected": True, "symlinkPidPreserved": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=pathlib.Path, required=True)
    parser.add_argument("--jar", type=pathlib.Path)
    parser.add_argument("--label", default="first")
    args = parser.parse_args()
    check(re.fullmatch(r"[a-z][a-z0-9-]{0,40}", args.label), "Safe evidence label required")
    app = args.app.resolve()
    check(app.is_relative_to(pathlib.Path("/private/tmp")) or app.is_relative_to(pathlib.Path(tempfile.gettempdir()).resolve()), "Only an isolated generated consumer is accepted")
    package = json.loads((app / "package.json").read_text())
    jar = (args.jar or app / "backend/target" / f"{package['name']}.jar").resolve()
    check(jar.is_file() and jar.is_relative_to(app), "Use this generated app JAR only")
    java = java_binary()
    stage = os.environ.get("SC_EVIDENCE_STAGE", "011")
    check(re.fullmatch(r"\d{3}", stage), "Safe evidence stage required")
    prefix = ROOT / "docs/검증" / (stage + "-generated-features-" + args.label)
    outputs = [prefix.with_suffix(".json"), prefix.with_suffix(".log"), prefix.parent / (prefix.name + "-runtime.log")]
    check(not any(file.exists() for file in outputs), "Evidence exists; choose a new label instead of overwriting")
    servers, results, lines = [], [], []
    parent = pathlib.Path(tempfile.mkdtemp(prefix="sc-generated-feature-reject-", dir=pathlib.Path(tempfile.gettempdir()).resolve()))
    phase = "setup"
    failure = None
    raw_logs = []
    def passed(name, **values):
        results.append({"name": name, "passed": True, **values})
        lines.append("PASS " + name)
        print(lines[-1], flush=True)
    try:
        phase = "profile and PID process ownership guards"
        passed(phase, **reject_and_pid_flow(app, jar, java, parent))
        for profile in (None, "audit", "file-storage", "audit,file-storage", "dev,audit", "dev,file-storage", "dev,audit,file-storage"):
            phase = "default prod OFF" if profile is None else "selected profile " + profile
            server = GeneratedServer(app, jar, java, profile)
            servers.append(server)
            flags = (profile or "").split(",")
            result = profile_flow(server, "audit" in flags, "file-storage" in flags)
            passed(phase, **result, secret600=True, ownedStopHelper=True)
        phase = "dev helper own Vite proxy and graceful shutdown"
        provenance = json.loads((app / "sc-starter.lock.json").read_text())
        frontend_port = provenance["app"]["frontendPort"]
        check(not listening(frontend_port), "Generated dev frontend port is already occupied")
        dev = GeneratedServer(app, jar, java, "dev")
        servers.append(dev)
        client = dev.start(dev=True, frontend_port=frontend_port)
        client.login()
        with urllib.request.urlopen(f"http://127.0.0.1:{frontend_port}/", timeout=10) as response:
            check(response.status == 200 and b'<div id="app">' in response.read(), "Generated dev Vite app is unavailable")
        with urllib.request.urlopen(f"http://127.0.0.1:{frontend_port}/api/health", timeout=10) as response:
            check(json.loads(response.read()).get("status") == "UP", "Generated dev proxy does not reach its selected backend")
        dev.stop(frontend_port=frontend_port)
        passed(phase, viteProxy=True, noBuildOrInstall=True)
    except Exception as error:
        failure = {"phase": phase, "exceptionType": type(error).__name__, "message": str(error) if isinstance(error, AssertionError) else "Fixture operation failed; inspect redacted runtime evidence"}
        results.append({"name": phase, "passed": False})
        lines.append("FAIL " + phase + " (" + type(error).__name__ + ")")
        print(lines[-1], flush=True)
    finally:
        cleanup_ok = True
        for server in reversed(servers):
            try:
                server.cleanup()
                all_logs = list(server.folder.rglob("*.log"))
                for log in all_logs:
                    text = log.read_text(errors="replace")
                    if server.password and server.password in text:
                        cleanup_ok = False
                        failure = failure or {"phase": "secret log boundary", "exceptionType": "AssertionError", "message": "Synthetic secret appeared in raw runtime output"}
                    if server.password:
                        text = text.replace(server.password, "<redacted-secret>")
                    text = text.replace(str(server.folder), "<isolated-fixture>").replace(str(app), "<generated-app>")
                    raw_logs.append(f"===== {server.profile or 'default-prod'} / {log.name} =====\n{text}")
                shutil.rmtree(server.folder)
                check(not server.folder.exists(), "Own fixture survived cleanup")
            except Exception:
                cleanup_ok = False
        shutil.rmtree(parent)
        report = {"passed": failure is None and cleanup_ok, "groups": results, "groupsPassed": sum(group["passed"] for group in results), "failure": failure,
                  "jarSha256": hashlib.sha256(jar.read_bytes()).hexdigest(), "plannedSelectedProfileGroups": 6, "selectedProfileGroupsPassed": sum(group["passed"] and group["name"].startswith("selected profile ") for group in results),
                  "plannedDefaultOffGroups": 1, "defaultOffGroupsPassed": sum(group["passed"] and group["name"] == "default prod OFF" for group in results),
                  "temporaryDataRemoved": cleanup_ok, "auditInspection": "stopped private H2 counts only; no HTTP audit controller",
                  "normalShutdownOnly": True, "crashRecoveryVerified": False, "npmInstallExecuted": False, "mavenExecuted": False, "browserExecuted": False}
        prefix.parent.mkdir(parents=True, exist_ok=True)
        outputs[0].write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        outputs[1].write_text("\n".join(lines) + "\n")
        outputs[2].write_text("\n".join(raw_logs))
        print(json.dumps({"passed": report["passed"], "groupsPassed": report["groupsPassed"], "temporaryDataRemoved": cleanup_ok}), flush=True)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
