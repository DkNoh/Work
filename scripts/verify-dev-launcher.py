#!/usr/bin/env python3
"""새 임시 자료로 개발 실행기의 환경 격리와 소유 프로세스 종료를 검증한다."""
import argparse
import json
import os
import pathlib
import shutil
import signal
import socket
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from _harness import ROOT


def unused_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def port_open(port):
    with socket.socket() as connection:
        connection.settimeout(0.3)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def group_members(group):
    listing = subprocess.run(
        ["ps", "-axo", "pid=,pgid="], capture_output=True, text=True, check=True,
    )
    return [
        int(parts[0]) for line in listing.stdout.splitlines()
        if len(parts := line.split()) == 2 and int(parts[1]) == group
    ]


def response(path, port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as result:
        return result.read()


def file_status(path, port):
    # 직접 만든 합성 파일만 요청하며 응답 내용은 출력하거나 결과 문서에 기록하지 않는다.
    url = f"http://127.0.0.1:{port}/@fs{urllib.parse.quote(str(path), safe='/')}"
    try:
        with urllib.request.urlopen(url, timeout=2) as result:
            return result.status
    except urllib.error.HTTPError as error:
        return error.code


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--log", type=pathlib.Path, default=ROOT / "docs/검증/001-dev-launcher.log")
args = parser.parse_args()
folder = pathlib.Path(tempfile.mkdtemp(prefix="sc-dev-launcher-test-"))
folder.chmod(0o700)
(ROOT / ".runtime").mkdir(exist_ok=True)
fixture_folder = pathlib.Path(tempfile.mkdtemp(prefix="synthetic-vite-", dir=ROOT / ".runtime"))
fixture_folder.chmod(0o700)
fixture_files = []
for name in ("synthetic.secret", "synthetic.mv.db", "synthetic.trace.db", "synthetic.txt"):
    fixture = fixture_folder / name
    descriptor = os.open(fixture, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write("synthetic fixture; never an actual password or database")
    fixture_files.append(fixture)
spring_port = unused_port()
frontend_port = unused_port()
while frontend_port == spring_port:
    frontend_port = unused_port()
process = None
output = []
phase = "launcher setup"
passed = False


def check(condition, message):
    global phase
    phase = message
    if not condition:
        raise AssertionError(message)
    output.append("PASS " + message)


try:
    env = os.environ.copy()
    # 모두 합성 값이다. 상속되면 기동이 실패하는 설정으로 외부 운영 설정 차단을 확인한다.
    env.update(
        SC_HOME=str(folder / "home"),
        SC_PORT=str(spring_port),
        SC_FRONTEND_PORT=str(frontend_port),
        SC_ADDRESS="192.0.2.1",
        SC_APP="starter",
        SC_APP_JAR=str(folder / "must-not-open.jar"),
        SC_DB_URL="jdbc:h2:tcp://127.0.0.1:1/must-not-connect",
        SC_DB_BASE=str(folder / "must-not-create"),
        SC_DB_USERNAME="synthetic-unused-user",
        SC_DB_PASSWORD="synthetic-unused-password",
        SC_BOOTSTRAP_USERNAME="synthetic-unused-user",
        SC_BOOTSTRAP_SECRET_FILE=str(folder / "must-not-read.secret"),
        SC_LOG_FILE=str(folder / "must-not-use.log"),
        SC_PROFILE="prod",
        SC_API_TARGET="http://127.0.0.1:1",
        SC_ECHO_URL="http://127.0.0.1:1",
        SPRING_DATASOURCE_URL="jdbc:h2:tcp://127.0.0.1:1/must-not-connect",
        SPRING_SECURITY_USER_PASSWORD="synthetic-unused-password",
        SPRING_APPLICATION_JSON="invalid-synthetic-json",
        SPRING_PROFILES_ACTIVE="must-not-activate",
        SERVER_ADDRESS="192.0.2.1",
        SERVER_PORT="1",
        LOGGING_CONFIG=str(folder / "must-not-read-log.xml"),
        LOGGING_LEVEL_ROOT="DEBUG",
        MANAGEMENT_SERVER_PORT="1",
        MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE="*",
        JAVA_TOOL_OPTIONS="-XX:MustNotBeAccepted",
        JDK_JAVA_OPTIONS="-XX:MustNotBeAccepted",
        _JAVA_OPTIONS="-XX:MustNotBeAccepted",
        APP_DB_URL="jdbc:h2:tcp://127.0.0.1:1/must-not-connect",
        WORKBOARD_DB_URL="jdbc:h2:tcp://127.0.0.1:1/must-not-connect",
    )
    with (folder / "process.log").open("wb") as log:
        process = subprocess.Popen(
            ["bash", str(ROOT / "scripts/dev.sh")], cwd=ROOT, env=env,
            stdout=log, stderr=log, start_new_session=True,
        )
        phase = "isolated Spring and Vite startup"
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("launcher exited before readiness")
            try:
                health = json.loads(response("/api/health", spring_port))
                frontend = response("/", frontend_port)
                if health.get("status") == "UP" and b'id="app"' in frontend:
                    break
            except (OSError, ValueError):
                pass
            time.sleep(0.25)
        else:
            raise TimeoutError("launcher readiness")
        check(health.get("application") == "sc-reference-app", "reference JAR overrides external app/JAR settings")
        check(b'id="app"' in frontend, "Vite serves the reference Vue app on an isolated port")
        secret_status = file_status(fixture_files[0], frontend_port)
        check(secret_status == 403, f"Vite blocks synthetic .runtime secret access with HTTP 403 (observed {secret_status})")
        runtime_statuses = [file_status(fixture, frontend_port) for fixture in fixture_files[1:]]
        check(all(status == 403 for status in runtime_statuses), "Vite blocks synthetic H2/trace and all .runtime files with HTTP 403")
        check(json.loads(response("/api/health", frontend_port)).get("status") == "UP", "Vite proxy uses the isolated Spring address")
        check("openapi" in json.loads(response("/v3/api-docs", spring_port)), "dev profile overrides inherited production profile")
        home = folder / "home"
        secret = home / "secrets/bootstrap.secret"
        check(stat.S_IMODE(secret.stat().st_mode) == 0o600, "new bootstrap secret has mode 600")
        check((home / "data/sc-reference.mv.db").is_file(), "H2 uses only the new SC_HOME data file")
        check((home / "run/app.lock").is_dir(), "launcher owns its runtime lock")
        java_pid = int((home / "run/app.pid").read_text().strip())
        members = group_members(process.pid)
        check(java_pid in members and len(members) >= 4, "Java and Vite belong to the new launcher process group")
        check((home / "run/app.jar").read_text().strip() == str(ROOT / "backend/reference-app/target/sc-reference-app.jar"), "runtime metadata points to the new reference JAR")
        log.flush()
        check(secret.read_text().strip().encode() not in (folder / "process.log").read_bytes(), "bootstrap password is absent from launcher output")
        # 그룹 전체가 아닌 실행기 하나에 TERM을 보내 자식 종료 책임을 직접 검증한다.
        phase = "launcher TERM and child cleanup"
        process.terminate()
        check(process.wait(timeout=45) == 143, "launcher handles TERM and exits with signal status")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline and group_members(process.pid):
            time.sleep(0.1)
        check(not group_members(process.pid), "owned Java/Vite processes are stopped")
        check(not port_open(spring_port) and not port_open(frontend_port), "Spring and Vite ports are released")
        check(not any((home / "run" / name).exists() for name in ("app.lock", "app.pid", "app.jar")), "runtime lock and PID/JAR metadata are removed")
        check(not any((folder / name).exists() for name in ("must-not-use.log", "must-not-create.mv.db")), "external synthetic paths were not used")
        passed = True
except Exception as error:
    # subprocess 인자·로그·환경·계정·CSRF 값을 결과 문서에 복사하지 않는다.
    output.append(f"FAIL {phase} ({type(error).__name__})")
finally:
    if process is not None:
        members = group_members(process.pid)
        if members:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=40)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
        # 실패한 경우에도 검증 때 생성한 프로세스만 정리한다.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and group_members(process.pid):
            time.sleep(0.1)
        if group_members(process.pid):
            os.killpg(process.pid, signal.SIGKILL)
            passed = False
            output.append("FAIL owned process cleanup")
    shutil.rmtree(folder)
    shutil.rmtree(fixture_folder)
    output.append("PASS temporary synthetic data and secret cleanup")
    args.log.parent.mkdir(parents=True, exist_ok=True)
    args.log.write_text("\n".join(output) + "\n")
    print("\n".join(output))

raise SystemExit(0 if passed else 1)
