#!/usr/bin/env python3
"""격리된 run.sh Starter에서 공통 파일 저장 SPI의 실제 두 번째 소비를 검증한다."""
import argparse
import json
import os
import pathlib
import shutil
import socket
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from _harness import ROOT, HttpClient, JarServer


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def java_binary():
    value = os.environ.get("JAVA_BIN")
    if not value:
        value = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java") if os.environ.get("JAVA21_HOME") else "java"
    return str(pathlib.Path(shutil.which(value) or value).resolve())


def reject_profile(server, app, profile, jar, expected_message):
    folder = server.folder / ("reject-" + app + "-" + profile.replace(",", "-"))
    folder.mkdir(mode=0o700)
    environment = {key: value for key, value in os.environ.items()
                   if not key.startswith(("APP_", "WORKBOARD_", "SC_", "SPRING_", "SERVER_", "LOGGING_", "MANAGEMENT_"))
                   and key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "JAVA21_HOME")}
    environment.update(JAVA_BIN=java_binary(), SC_HOME=str(folder), SC_APP=app, SC_APP_JAR=str(jar),
                       SC_PROFILE=profile, SC_PORT="0", SC_ADDRESS="127.0.0.1",
                       SC_BOOTSTRAP_USERNAME="admin", SC_BOOTSTRAP_SECRET_FILE=str(server.secret))
    result = subprocess.run(["bash", str(ROOT / "scripts/run.sh")], env=environment, cwd=folder,
                            capture_output=True, text=True, timeout=15)
    check(result.returncode != 0 and expected_message in result.stderr,
          "Launcher did not reject the invalid profile before execution")
    check(not list(folder.iterdir()), "Rejected profile created runtime files")


def start(server):
    check(stat.S_IMODE(server.secret.stat().st_mode) == 0o600, "Synthetic secret must have mode 600")
    server.start()
    run = server.folder / "run"
    check((run / "app.lock").is_dir(), "Launcher process lock is missing")
    check((run / "app.jar").read_text().strip() == str(server.jar), "Launcher selected a different JAR")
    child = int((run / "app.pid").read_text().strip())
    check(child > 0 and child != server.process.pid, "Launcher did not record its Java child")
    return child


def stop(server, child):
    address = urllib.parse.urlsplit(server.base_url)
    process = server.process
    server.stop()
    check(process.returncode == 143, "Launcher did not handle TERM")
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
        remaining = any((server.folder / "run" / name).exists() for name in ("app.lock", "app.pid", "app.jar"))
        if not running and not listening and not remaining:
            return
        time.sleep(0.1)
    raise AssertionError("Launcher did not terminate Java and release runtime resources")


def raw(client, path, method="GET", body=None, content_type=None, expected=200, csrf=True):
    headers = {}
    if method not in ("GET", "HEAD", "OPTIONS") and csrf:
        if client.csrf is None:
            client.csrf = client.request("/api/auth/csrf")
        headers[client.csrf["headerName"]] = client.csrf["token"]
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(client.server.base_url + path, method=method, data=body, headers=headers)
    try:
        response = client.opener.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        status = response.status
        content = response.read()
        response_headers = response.headers
    check(status == expected, "Storage HTTP response did not match its safe expected status")
    return content, response_headers


def multipart(client, payload, expected=200, csrf=True):
    boundary = "sc-storage-fixture-" + uuid.uuid4().hex
    prefix = ("--" + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="fixture.bin"'
              '\r\nContent-Type: application/octet-stream\r\n\r\n').encode("ascii")
    body = prefix + payload + ("\r\n--" + boundary + "--\r\n").encode("ascii")
    content, _ = raw(client, "/api/storage-demo", "POST", body, "multipart/form-data; boundary=" + boundary,
                     expected=expected, csrf=csrf)
    return json.loads(content) if content else None


def assert_no_secret(server):
    for log in server.folder.glob("*.log"):
        check(server.password.encode() not in log.read_bytes(), "Synthetic secret appeared in runtime output")


def swagger(client, enabled):
    if enabled:
        document = client.request("/v3/api-docs")
        check(document.get("openapi", "").startswith("3."), "dev storage profile did not expose Swagger")
        check("/api/storage-demo" in document.get("paths", {}), "Optional storage endpoint is absent from live Swagger")
    else:
        check(client.request("/v3/api-docs", expected=403).get("code") == "FORBIDDEN", "Production Swagger was not denied")


def roundtrip(server, full=False):
    client = HttpClient(server)
    check(client.request("/api/storage-demo/" + str(uuid.uuid4()), expected=401).get("code") == "AUTH_REQUIRED",
          "Anonymous file read did not require a session")
    client.login()
    check(client.request("/api/auth/me") == {"username": "admin", "roles": ["ADMIN"]}, "Starter identity contract changed")
    payload = b"synthetic-storage-spi\x00\xff\r\n"
    if full:
        check(multipart(client, payload, expected=403, csrf=False).get("code") == "CSRF", "Upload did not enforce CSRF")
        check(multipart(client, b"", expected=400).get("code") == "INVALID_INPUT", "Empty upload was accepted")
        check(multipart(client, b"x" * (10 * 1024 * 1024 + 1), expected=413).get("code") == "FILE_TOO_LARGE", "Oversized upload was accepted")
    entry = multipart(client, payload)
    check(set(entry) == {"key", "size"} and entry["size"] == len(payload), "Storage response included unexpected metadata")
    key = entry["key"]
    check(str(uuid.UUID(key)) == key, "Storage did not return an opaque UUID")
    check(str(server.folder) not in json.dumps(entry), "Storage API exposed an internal root")
    root = server.folder / "uploads"
    check((root / key).read_bytes() == payload, "Adapter did not write the original bytes to its isolated root")
    downloaded, headers = raw(client, "/api/storage-demo/" + key)
    check(downloaded == payload and headers.get("Cache-Control") == "no-store", "Authenticated file round-trip failed")
    check(headers.get("Content-Type") == "application/octet-stream" and headers.get("Content-Disposition", "").startswith("attachment;"),
          "Neutral file download headers changed")
    for invalid in (str(uuid.uuid4()), "not-a-valid-key"):
        check(client.request("/api/storage-demo/" + invalid, expected=404).get("code") == "NOT_FOUND", "Unknown key bypassed whitelist")
    raw(client, "/api/storage-demo/" + key, "DELETE", expected=403, csrf=False)
    raw(client, "/api/storage-demo/" + key, "DELETE", expected=204)
    check(not (root / key).exists(), "Explicit deletion did not remove its opaque file")
    client.request("/api/storage-demo/" + key, expected=404)
    if full:
        check(not list(root.iterdir()), "Rejected uploads left partial files")
        # 현재 실행 metadata에 없는 파일을 자기 임시 root에 합성한다.
        external_key = str(uuid.uuid4())
        (root / external_key).write_bytes(b"synthetic-unregistered-file")
        client.request("/api/storage-demo/" + external_key, expected=404)
        retained = multipart(client, payload)
        return retained["key"], external_key, payload
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", type=pathlib.Path, default=ROOT / "backend/starter-app/target/sc-starter-app.jar")
    parser.add_argument("--reference-jar", type=pathlib.Path, default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
    parser.add_argument("--log", type=pathlib.Path, default=ROOT / "docs/검증/010-starter-storage.log")
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "docs/검증/010-starter-storage.json")
    args = parser.parse_args()
    servers = []
    results = []
    phase = "isolated fixture preparation"
    failed = False
    def passed(label, **values):
        results.append({"name": label, "passed": True, **values})
        print("PASS " + label, flush=True)
    try:
        baseline = JarServer(args.jar, profile="", launcher=True)
        servers.append(baseline)
        phase = "profile rejection before runtime files"
        for app, profile, jar, expected in (
            ("starter", "file-storage,dev", baseline.jar, "SC_PROFILE은"),
            ("starter", "file-storage,invalid", baseline.jar, "SC_PROFILE은"),
            ("reference", "file-storage", args.reference_jar.resolve(), "file-storage 프로필은 Starter"),
        ):
            reject_profile(baseline, app, profile, jar, expected)
        passed("invalid and Reference profiles rejected before runtime creation", cases=3)
        phase = "default Starter no root or endpoint"
        child = start(baseline)
        client = HttpClient(baseline)
        client.login()
        client.request("/api/storage-demo/" + str(uuid.uuid4()), expected=404)
        check(not (baseline.folder / "uploads").exists(), "Default Starter created a file storage root")
        assert_no_secret(baseline)
        stop(baseline, child)
        passed("default Starter endpoint/root absent and launcher clean shutdown")
        for profile in ("file-storage", "dev,file-storage", "prod,file-storage", "audit,file-storage", "dev,audit,file-storage", "prod,audit,file-storage"):
            phase = "optional profile " + profile
            server = JarServer(args.jar, profile=profile, launcher=True)
            servers.append(server)
            child = start(server)
            check(not (server.folder / "uploads").exists(), "Storage root was created before first upload")
            retained = roundtrip(server, full=profile == "file-storage")
            authenticated = HttpClient(server)
            authenticated.login()
            swagger(authenticated, "dev" in profile.split(","))
            assert_no_secret(server)
            stop(server, child)
            if retained:
                key, external_key, payload = retained
                root = server.folder / "uploads"
                check(not (root / key).exists(), "Graceful shutdown did not clean its current-run file")
                check((root / external_key).is_file(), "Shutdown removed an unregistered file")
                # 다른 실행의 metadata를 복구하지 않는 경계를 실제 원본 bytes로 검증한다.
                (root / key).write_bytes(payload)
                child = start(server)
                restarted = HttpClient(server)
                restarted.login()
                restarted.request("/api/storage-demo/" + key, expected=404)
                restarted.request("/api/storage-demo/" + external_key, expected=404)
                check((root / key).read_bytes() == payload, "Restart unexpectedly registered or transformed old bytes")
                assert_no_secret(server)
                stop(server, child)
                (root / key).unlink()
                (root / external_key).unlink()
            passed("actual launcher/session/CSRF/storage/Swagger profile " + profile, restartWhitelist=bool(retained))
    except Exception as error:
        failed = True
        results.append({"name": phase, "passed": False, "exceptionType": type(error).__name__})
        print("FAIL " + phase + " (" + type(error).__name__ + ")", flush=True)
    finally:
        cleanup_ok = True
        for server in reversed(servers):
            try:
                server.cleanup()
                check(not server.folder.exists(), "Temporary fixture survived cleanup")
            except Exception:
                cleanup_ok = False
        failed = failed or not cleanup_ok
        report = {"stage": "010", "passed": not failed, "checks": results, "groups": len([item for item in results if item["passed"]]),
                  "temporaryDirectoriesRemoved": cleanup_ok, "productionRuntimeUsed": False,
                  "referenceBusinessMetadataUsed": False, "syntheticSecretsPrinted": None if failed else False,
                  "nonAdminRoleHttp": "MockMvc synthetic two-role consumer test; deployed Starter bootstrap exposes ADMIN only"}
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text("\n".join(("PASS " if item["passed"] else "FAIL ") + item["name"] for item in results) + "\n", encoding="utf-8")
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
