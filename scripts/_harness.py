"""격리된 JAR 서버·합성 계정의 수명만 관리한다. 실행 자료나 비밀값을 출력하지 않는다."""
import http.cookiejar
import json
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]


class JarServer:
    def __init__(self, jar, port=0, profile="dev", launcher=False, extra_environment=None):
        self.jar = pathlib.Path(jar).resolve()
        if not self.jar.is_file():
            raise RuntimeError("검증할 JAR가 없습니다. scripts/build.sh를 먼저 실행하세요.")
        # macOS /var·/tmp 링크를 따라 실제 테스트 경로를 고정한다. 운영 모듈은 링크 root를 거절한다.
        self.folder = pathlib.Path(tempfile.mkdtemp(prefix="sc-framework-test-")).resolve()
        self.folder.chmod(0o700)
        (self.folder / "data").mkdir()
        self.secret = self.folder / "bootstrap.secret"
        self.password = secrets.token_urlsafe(24)
        descriptor = os.open(self.secret, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(self.password)
        self.port = port
        self.profile = profile
        self.launcher = launcher
        self.extra_environment = dict(extra_environment or {})
        if any(not key.startswith("SC_") or not isinstance(value, str)
               for key, value in self.extra_environment.items()):
            raise ValueError("Test overrides must be explicit SC_ string settings")
        self.process = None
        self.log = None
        self.base_url = None
        self.start_count = 0

    def start(self):
        if self.process is not None and self.process.poll() is None:
            raise RuntimeError("검증 서버가 이미 실행 중입니다.")
        self.start_count += 1
        log_path = self.folder / f"process-{self.start_count}.log"
        self.log = log_path.open("wb")
        # 부모의 운영 프로필·DB URL·계정 설정을 테스트 자료로 상속하지 않는다.
        env = {
            key: value for key, value in os.environ.items()
            if not key.startswith(("APP_", "WORKBOARD_", "SC_", "SPRING_", "SERVER_", "LOGGING_", "MANAGEMENT_"))
            and key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS")
        }
        env.update(
            SC_DB_URL=f"jdbc:h2:file:{self.folder / 'data' / 'test'};DB_CLOSE_ON_EXIT=FALSE",
            SC_PORT=str(self.port),
            SC_ADDRESS="127.0.0.1",
            SC_BOOTSTRAP_USERNAME="admin",
            SC_BOOTSTRAP_SECRET_FILE=str(self.secret),
            SC_LOG_FILE=str(self.folder / "application.log"),
            SC_UPLOAD_DIR=str(self.folder / "uploads"),
            SPRING_PROFILES_ACTIVE=self.profile,
            SC_HOME=str(self.folder),
        )
        env.update(self.extra_environment)
        java = os.environ.get("JAVA_BIN")
        if not java:
            java = (
                str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
                if os.environ.get("JAVA21_HOME") else "java"
            )
        version = subprocess.run([java, "-version"], capture_output=True, text=True, check=True)
        if not re.search(r'version "21(?:\.|\")', version.stderr + version.stdout):
            raise RuntimeError("JAR 검증에는 JDK 21이 필요합니다. JAVA21_HOME 또는 JAVA_BIN을 지정하세요.")
        command = [java, "-Xms128m", "-Xmx512m", "-jar", str(self.jar)]
        if self.launcher:
            # run.sh가 비어 있는 프로필도 명시적으로 받도록 격리 경로와 JDK를 전달한다.
            env.update(
                SC_HOME=str(self.folder), SC_APP="starter", SC_APP_JAR=str(self.jar),
                SC_PROFILE=self.profile, JAVA_BIN=str(pathlib.Path(shutil.which(java) or java).resolve()),
            )
            env.pop("JAVA21_HOME", None)
            command = ["bash", str(ROOT / "scripts/run.sh")]
        self.process = subprocess.Popen(
            command,
            env=env, cwd=self.folder, stdout=self.log, stderr=self.log,
        )
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError(f"검증 서버 기동 실패. 로그 파일: {log_path}")
            match = re.search(
                r"Tomcat started on port (\d+)", log_path.read_text(errors="replace")
            )
            if match:
                self.base_url = "http://127.0.0.1:" + match.group(1)
                try:
                    health = HttpClient(self).request("/api/health")
                    if health.get("status") == "UP":
                        return
                except (OSError, AssertionError, ValueError):
                    pass
            time.sleep(0.25)
        raise RuntimeError(f"검증 서버 준비 시간 초과. 로그 파일: {log_path}")

    def stop(self):
        try:
            if self.process is not None and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=40)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=10)
                    raise RuntimeError("검증 서버 정상 종료 시간이 초과되었습니다.")
        finally:
            if self.log is not None:
                self.log.close()
            self.log = None
            self.process = None

    def cleanup(self, keep=False):
        try:
            self.stop()
        finally:
            self.secret.unlink(missing_ok=True)
            if not keep:
                shutil.rmtree(self.folder)


class HttpClient:
    def __init__(self, server):
        self.server = server
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )
        self.csrf = None

    def request(self, path, method="GET", data=None, expected=200, csrf=True, form=False):
        headers = {}
        if method not in ("GET", "HEAD", "OPTIONS") and csrf:
            if self.csrf is None:
                self.csrf = self.request("/api/auth/csrf")
            headers[self.csrf["headerName"]] = self.csrf["token"]
        body = None
        if data is not None:
            body = (
                urllib.parse.urlencode(data).encode() if form
                else json.dumps(data).encode()
            )
            headers["Content-Type"] = (
                "application/x-www-form-urlencoded" if form else "application/json"
            )
        request = urllib.request.Request(
            self.server.base_url + path, method=method, data=body, headers=headers
        )
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status = response.status
            content_type = response.headers.get("Content-Type", "")
            content = response.read()
        if status != expected:
            # 인증 요청·응답이나 쿠키·CSRF를 AssertionError에 포함하지 않는다.
            raise AssertionError(f"{method} {path}: HTTP {expected} 대신 {status}")
        return json.loads(content) if content and "application/json" in content_type else content

    def login(self):
        self.request(
            "/api/auth/login", "POST",
            {"username": "admin", "password": self.server.password},
            expected=204, form=True,
        )
        self.csrf = self.request("/api/auth/csrf")
