#!/usr/bin/env python3
"""run.sh로 Starter의 선택 감사·프로필·종료·H2 재시작을 격리 검증한다."""
import argparse
import os
import pathlib
import re
import shutil
import socket
import stat
import subprocess
import time
import urllib.parse
import zipfile

from _harness import ROOT, HttpClient, JarServer


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def java_binary():
    value = os.environ.get("JAVA_BIN")
    if not value:
        value = (
            str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
            if os.environ.get("JAVA21_HOME") else "java"
        )
    return str(pathlib.Path(shutil.which(value) or value).resolve())


def rejection_environment(server, folder, app, profile, jar):
    env = {
        key: value for key, value in os.environ.items()
        if not key.startswith(("APP_", "WORKBOARD_", "SC_", "SPRING_", "SERVER_", "LOGGING_", "MANAGEMENT_"))
        and key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "JAVA21_HOME")
    }
    env.update(
        JAVA_BIN=java_binary(), SC_HOME=str(folder), SC_APP=app,
        SC_APP_JAR=str(jar), SC_PROFILE=profile, SC_PORT="0", SC_ADDRESS="127.0.0.1",
        SC_BOOTSTRAP_USERNAME="admin", SC_BOOTSTRAP_SECRET_FILE=str(server.secret),
    )
    return env


def reject_profile(server, app, profile, jar, expected_message):
    folder = server.folder / f"rejected-{app}-{profile.replace(',', '-')}"
    folder.mkdir(mode=0o700)
    result = subprocess.run(
        ["bash", str(ROOT / "scripts/run.sh")],
        env=rejection_environment(server, folder, app, profile, jar),
        cwd=folder, capture_output=True, text=True, timeout=15,
    )
    check(result.returncode != 0 and expected_message in result.stderr,
          "run.sh profile allowlist did not reject the requested combination")
    check(not list(folder.iterdir()), "Rejected profile created runtime files")


def started_launcher(server):
    check(stat.S_IMODE(server.secret.stat().st_mode) == 0o600,
          "Synthetic bootstrap secret must have mode 600")
    server.start()
    run = server.folder / "run"
    check((run / "app.lock").is_dir(), "run.sh did not create its process lock")
    check((run / "app.jar").read_text().strip() == str(server.jar),
          "run.sh did not record the selected Starter JAR")
    child = int((run / "app.pid").read_text().strip())
    check(child > 0 and child != server.process.pid,
          "run.sh did not record its separate Java child")
    for log in server.folder.glob("*.log"):
        check(server.password.encode() not in log.read_bytes(),
              "Synthetic bootstrap secret appeared in launcher output")
    return child


def stopped_launcher(server, child):
    address = urllib.parse.urlsplit(server.base_url)
    process = server.process
    server.stop()
    check(process.returncode == 143, "run.sh did not report its handled TERM signal")
    # 종료 신호가 Java에 전달되고 포트/잠금/메타데이터가 함께 해제돼야 한다.
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            os.kill(child, 0)
            running = True
        except ProcessLookupError:
            running = False
        with socket.socket() as probe:
            probe.settimeout(0.2)
            listening = probe.connect_ex((address.hostname, address.port)) == 0
        remaining = any((server.folder / "run" / name).exists()
                        for name in ("app.lock", "app.pid", "app.jar"))
        if not running and not listening and not remaining:
            return
        time.sleep(0.1)
    raise AssertionError("run.sh did not stop Java and clean its runtime metadata")


def authenticated_me(client):
    check(client.request("/api/auth/me") == {"username": "admin", "roles": ["ADMIN"]},
          "Starter default me must contain only username and roles")


def swagger(client, enabled):
    if enabled:
        document = client.request("/v3/api-docs")
        check(isinstance(document, dict) and document.get("openapi", "").startswith("3."),
              "dev,audit did not expose the actual OpenAPI document")
        check(b"Swagger UI" in client.request("/swagger-ui/index.html"),
              "dev,audit did not expose Swagger UI")
    else:
        for path in ("/v3/api-docs", "/swagger-ui/index.html"):
            check(client.request(path, expected=403).get("code") == "FORBIDDEN",
                  "Non-dev Swagger must be denied to an authenticated user")


def security_flow(server, swagger_enabled=False):
    client = HttpClient(server)
    check(client.request("/api/auth/me", expected=401).get("code") == "AUTH_REQUIRED",
          "Anonymous me did not require authentication")
    check(client.request("/api/auth/login", "POST",
                         {"username": "admin", "password": server.password},
                         expected=403, csrf=False, form=True).get("code") == "CSRF",
          "Tokenless login did not enforce CSRF")
    check(client.request("/api/auth/login", "POST",
                         {"username": "missing-user", "password": "synthetic-invalid-credential"},
                         expected=401, form=True).get("code") == "AUTH_FAILED",
          "Invalid login did not return the safe authentication error")
    client.login()
    authenticated_me(client)
    check(client.request("/api/auth/logout", "POST", expected=403, csrf=False).get("code") == "CSRF",
          "Tokenless logout did not enforce CSRF")
    authenticated_me(client)
    swagger(client, swagger_enabled)
    client.request("/api/auth/logout", "POST", expected=204)
    check(client.request("/api/auth/me", expected=401).get("code") == "AUTH_REQUIRED",
          "Logout did not invalidate the authenticated session")


class H2Counts:
    def __init__(self, server):
        self.server = server
        # 배포 JAR에 실제 포함된 H2 버전만 자기 임시 디렉터리로 꺼낸다.
        self.jar = server.folder / "h2-inspection.jar"
        with zipfile.ZipFile(server.jar) as archive:
            matches = [name for name in archive.namelist()
                       if re.fullmatch(r"BOOT-INF/lib/h2-[^/]+\.jar", name)]
            check(len(matches) == 1, "Starter JAR must contain exactly one H2 driver")
            self.jar.write_bytes(archive.read(matches[0]))

    def read(self, expressions):
        check(self.server.process is None, "H2 inspection requires a stopped server")
        check((self.server.folder / "data/test.mv.db").is_file(),
              "The isolated H2 database does not exist")
        # COUNT·테이블 메타데이터만 반환한다. 계정·감사 원문·토큰은 조회하지 않는다.
        sql = "SELECT " + ", ".join(f"({query}) AS {name}" for name, query in expressions.items()) + ";"
        result = subprocess.run(
            [java_binary(), "-cp", str(self.jar), "org.h2.tools.Shell", "-url",
             f"jdbc:h2:file:{self.server.folder / 'data/test'};IFEXISTS=TRUE;ACCESS_MODE_DATA=r",
             "-user", "sa", "-password", "", "-properties", "null", "-list", "-sql", sql],
            cwd=self.server.folder, capture_output=True, text=True, timeout=20,
        )
        check(result.returncode == 0 and not result.stderr.strip() and "Error:" not in result.stdout,
              "Read-only isolated H2 count inspection failed")
        values = {name: int(value) for name, value in
                  re.findall(r"(?m)^([A-Z_]+)\s*:\s*(\d+)\s*$", result.stdout)}
        check(set(values) == set(expressions), "H2 count inspection returned an unexpected shape")
        return values

    def schema(self, audit):
        values = self.read({
            "TABLES": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'",
            "AUDIT_TABLES": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='SECURITY_AUDIT_EVENT'",
            "MIGRATION_TABLES": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='flyway_schema_history'",
            "FOREIGN_KEYS": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='PUBLIC'",
        })
        expected = {"TABLES": 2 if audit else 0, "AUDIT_TABLES": int(audit),
                    "MIGRATION_TABLES": int(audit), "FOREIGN_KEYS": 0}
        check(values == expected, "Starter owns unexpected business tables or audit foreign keys")
        if audit:
            migration = self.read({
                "SUCCESSFUL_V_ONE": 'SELECT COUNT(*) FROM "flyway_schema_history" WHERE "version"=\'1\' AND "success"=TRUE',
                "VERSIONED_MIGRATIONS": 'SELECT COUNT(*) FROM "flyway_schema_history" WHERE "version" IS NOT NULL',
            })
            check(migration == {"SUCCESSFUL_V_ONE": 1, "VERSIONED_MIGRATIONS": 1},
                  "Starter audit must use its own successful V1 migration only")

    def events(self):
        criteria = {
            "LOGIN_SUCCESS": "action='AUTH_LOGIN' AND outcome='SUCCESS' AND reason_code='OK'",
            "LOGIN_FAILURE": "action='AUTH_LOGIN' AND outcome='FAILURE' AND reason_code='AUTH_FAILED'",
            "LOGOUT_SUCCESS": "action='AUTH_LOGOUT' AND outcome='SUCCESS' AND reason_code='OK'",
            "AUTH_REQUIRED": "action='HTTP_ACCESS' AND outcome='DENIED' AND reason_code='AUTH_REQUIRED'",
            "CSRF_DENIED": "action='HTTP_ACCESS' AND outcome='DENIED' AND reason_code='CSRF'",
            "FORBIDDEN": "action='HTTP_ACCESS' AND outcome='DENIED' AND reason_code='FORBIDDEN'",
        }
        return self.read({
            "TOTAL": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT",
            **{name: f"SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE {condition}"
               for name, condition in criteria.items()},
            "UNEXPECTED_FIELDS": "SELECT COUNT(*) FROM SECURITY_AUDIT_EVENT WHERE actor_id IS NOT NULL OR resource_type <> 'HTTP' OR resource_id IS NOT NULL OR reason_code NOT IN ('OK','AUTH_FAILED','AUTH_REQUIRED','CSRF','FORBIDDEN')",
        })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", type=pathlib.Path,
                        default=ROOT / "backend/starter-app/target/sc-starter-app.jar")
    parser.add_argument("--reference-jar", type=pathlib.Path,
                        default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
    parser.add_argument("--log", type=pathlib.Path,
                        default=ROOT / "docs/검증/007-starter-audit-launcher.log")
    args = parser.parse_args()
    check(args.reference_jar.resolve().is_file(), "Build the fresh Reference JAR before validation")
    servers = []
    lines = []
    phase = "isolated fixture preparation"
    failed = False

    def passed(message):
        line = "PASS " + message
        lines.append(line)
        print(line, flush=True)

    try:
        baseline = JarServer(args.jar, profile="", launcher=True)
        servers.append(baseline)
        phase = "run.sh rejects invalid and Reference audit profiles before runtime creation"
        reject_profile(baseline, "starter", "dev,invalid", baseline.jar, "SC_PROFILE은")
        for profile in ("audit", "dev,audit", "prod,audit"):
            reject_profile(baseline, "reference", profile, args.reference_jar.resolve(),
                           "audit 프로필은 Starter")
        passed("invalid profile and all Reference audit combinations rejected without runtime files")

        phase = "default Starter run.sh authentication, Swagger denial and empty schema"
        child = started_launcher(baseline)
        security_flow(baseline)
        stopped_launcher(baseline, child)
        H2Counts(baseline).schema(audit=False)
        passed("default Starter: login/logout, 401/403, exact username/roles, Swagger denial, no tables")
        passed("run.sh TERM forwarded to Java; port, lock and process metadata removed")

        audit = JarServer(args.jar, profile="audit", launcher=True)
        servers.append(audit)
        phase = "plain audit Starter authentication and own V1 persistence"
        child = started_launcher(audit)
        security_flow(audit)
        stopped_launcher(audit, child)
        inspection = H2Counts(audit)
        inspection.schema(audit=True)
        before = inspection.events()
        check(before == {"TOTAL": 9, "LOGIN_SUCCESS": 1, "LOGIN_FAILURE": 1,
                         "LOGOUT_SUCCESS": 1, "AUTH_REQUIRED": 2, "CSRF_DENIED": 2,
                         "FORBIDDEN": 2, "UNEXPECTED_FIELDS": 0},
              "Actual Starter security requests were not audited exactly once with safe fields")
        passed("audit: 9 real security events persisted exactly once; own V1 only; no Reference tables")

        phase = "same audit database restart retains every count without new requests"
        child = started_launcher(audit)
        stopped_launcher(audit, child)
        inspection.schema(audit=True)
        check(inspection.events() == before, "Restart lost or recreated persisted audit rows")
        passed("audit restart preserves all persisted event counts and its V1 migration")

        for profile, enabled in (("dev,audit", True), ("prod,audit", False)):
            phase = f"{profile} run.sh allowlist, Swagger policy and retained audit database"
            audit.profile = profile
            child = started_launcher(audit)
            client = HttpClient(audit)
            client.login()
            authenticated_me(client)
            swagger(client, enabled)
            client.request("/api/auth/logout", "POST", expected=204)
            stopped_launcher(audit, child)
            inspection.schema(audit=True)
            after = inspection.events()
            check(after["TOTAL"] == before["TOTAL"] + (2 if enabled else 4)
                  and after["LOGIN_SUCCESS"] == before["LOGIN_SUCCESS"] + 1
                  and after["LOGOUT_SUCCESS"] == before["LOGOUT_SUCCESS"] + 1
                  and after["LOGIN_FAILURE"] == before["LOGIN_FAILURE"]
                  and after["AUTH_REQUIRED"] == before["AUTH_REQUIRED"]
                  and after["CSRF_DENIED"] == before["CSRF_DENIED"]
                  and after["FORBIDDEN"] == before["FORBIDDEN"] + (0 if enabled else 2)
                  and after["UNEXPECTED_FIELDS"] == 0,
                  "Profile restart did not preserve old audit events and append the expected new events")
            before = after
            passed(f"{profile}: exact default me, Swagger {'allowed' if enabled else 'denied'}, retained and appended audit events")
    except Exception as error:
        # HTTP/SQL 본문·쿠키·토큰·계정·비밀번호·예외 인자를 검증 기록에 출력하지 않는다.
        failed = True
        lines.append(f"FAIL {phase} ({type(error).__name__})")
        print(lines[-1], flush=True)
    finally:
        for server in reversed(servers):
            try:
                server.cleanup()
            except (OSError, RuntimeError, subprocess.SubprocessError):
                failed = True
                lines.append("FAIL isolated process or file cleanup")
        if not failed:
            passed("all isolated servers, H2 files, extracted driver and synthetic secret files cleaned up")
        log = ROOT / args.log
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_text("\n".join(lines) + "\n")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
