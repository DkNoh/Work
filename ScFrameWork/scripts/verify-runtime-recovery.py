"""자기 임시 ops JAR의 lock/실제 adapter crash/백업·새 root 복원을 검증한다."""
import argparse
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import uuid
import zipfile
from _harness import ROOT, HttpClient
from _operations_harness import operations_server


def check(value, code):
    if not value:
        raise AssertionError(code)


def wait(checker, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if checker():
            return
        time.sleep(.1)
    raise AssertionError("SC_RECOVERY_TIMEOUT")


def command(arguments, expected=0):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, timeout=120)
    check(result.returncode == expected, "SC_RECOVERY_CLI_STATUS")
    return result


def crash_actual_adapter(server, folder):
    java = os.environ.get("JAVA_BIN")
    if not java:
        java = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java") if os.environ.get("JAVA21_HOME") else "java"
    classes = []
    with zipfile.ZipFile(server.jar) as archive:
        for name in ("framework-core", "framework-autoconfigure"):
            entries = [entry for entry in archive.infolist() if entry.filename.startswith("BOOT-INF/lib/" + name + "-") and entry.filename.endswith(".jar")]
            check(len(entries) == 1, "SC_CRASH_ADAPTER_CLASS_MISSING")
            target = folder / (name + ".jar")
            target.write_bytes(archive.read(entries[0]))
            classes.append(str(target))
    log = folder / "crash-writer.log"
    environment = {key: value for key, value in os.environ.items() if key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS")}
    child = None
    try:
        with log.open("wb") as output:
            child = subprocess.Popen([java, "--class-path", os.pathsep.join(classes), str(ROOT / "scripts/ScStorageCrashWriter.java"), str(server.folder / "uploads")], stdout=output, stderr=output, env=environment)
            wait(lambda: child.poll() is not None or b"SC_PARTIAL_READY" in log.read_bytes())
            check(child.poll() is None, "SC_CRASH_ADAPTER_START_FAILED")
            pending = list((server.folder / "uploads/.pending").iterdir())
            check(len(pending) == 1, "SC_CRASH_PARTIAL_COUNT")
            key = pending[0].name
            check((server.folder / "uploads/.part" / key).stat().st_size == 1024, "SC_CRASH_PARTIAL_BYTES")
            child.kill()
            child.wait(timeout=10)
            check(child.returncode != 0, "SC_CRASH_WRITER_NOT_KILLED")
        return key
    finally:
        if child is not None and child.poll() is None:
            child.kill()
            child.wait(timeout=10)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shared-home", default=str(ROOT / ".runtime/operations"))
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "docs/검증/012-runtime-recovery.json")
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("sc_media_fixture", ROOT / "scripts/verify-reference-media.py")
    fixture = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fixture)
    server = None
    restored = None
    folder = pathlib.Path(tempfile.mkdtemp(prefix="sc-runtime-recovery-")).resolve()
    folder.chmod(0o700)
    checks = []
    phase = "prepare isolated runtime"
    error = None
    author_password = secrets.token_urlsafe(24)
    def passed(name, **detail):
        checks.append({"name": name, "passed": True, **detail})
        print("PASS " + name, flush=True)
    try:
        server = operations_server("reference", management_port=18488, shared_home=args.shared_home)
        stable_jar = folder / "reference-fixture.jar"
        before_jar = hashlib.sha256(server.jar.read_bytes()).hexdigest()
        shutil.copyfile(server.jar, stable_jar)
        check(hashlib.sha256(stable_jar.read_bytes()).hexdigest() == before_jar == hashlib.sha256(server.jar.read_bytes()).hexdigest(), "SC_RECOVERY_JAR_CHANGED_DURING_COPY")
        server.jar = stable_jar
        server.extra_environment["SC_FRAMEWORK_MESSAGING_APPLICATIONID"] = "test-ref-" + uuid.uuid4().hex
        server.start()
        admin = HttpClient(server)
        admin.login()
        phase = "active Java NIO lock rejects Python backup"
        active = command(["python3", str(ROOT / "scripts/backup-runtime.py"), "--runtime-root", str(server.folder), "--jar", str(server.jar), "--output", str(folder / "active-backup")], expected=1)
        check(b"SC_BACKUP_RUNTIME_ACTIVE" in active.stderr and not (folder / "active-backup").exists(), "SC_RECOVERY_LOCK_NOT_SHARED")
        passed(phase)
        phase = "create actual durable metadata original image PDF and message"
        actor = admin.request("/api/users", "POST", {"username": "recovery-author", "displayName": "Synthetic recovery author", "password": author_password, "role": "REQUESTER"})
        menu = admin.request("/api/menus", "POST", {"name": "Synthetic recovery menu", "sortOrder": 0})
        screen = admin.request("/api/screens", "POST", {"menuId": menu["id"], "name": "Synthetic recovery screen"})
        client = HttpClient(server)
        client.request("/api/auth/login", "POST", {"username": "recovery-author", "password": author_password}, expected=204, form=True)
        client.csrf = client.request("/api/auth/csrf")
        image = fixture.synthetic_png()
        pdf = fixture.synthetic_pdf()
        version = fixture.upload(client, f'/api/screens/{screen["id"]}/versions', image, "fixture.png", "image/png")
        requirement = client.request("/api/requirements", "POST", {"title": "Synthetic recovery requirement", "menuId": menu["id"], "desired": "Synthetic", "reason": "Synthetic", "referenceText": "", "similar": False, "followParts": "", "screenVersionId": version["id"], "annotation": {"x": .1, "y": .1, "width": .5, "height": .5}, "revision": 1})
        detail = fixture.upload(client, f'/api/requirements/{requirement["id"]}/attachments?revision=1', pdf, "fixture.pdf", "application/pdf")
        message = admin.request("/api/operations/messages/demo", "POST", {}, expected=202)
        def completed():
            items = admin.request("/api/operations/messages?type=MESSAGE_DEMO&size=100")["items"]
            return any(row["eventId"] == message["eventId"] and row["state"] == "COMPLETED" for row in items)
        wait(completed)
        passed(phase, revision=2)
        phase = "SIGKILL actual storage adapter after forced journal and partial bytes"
        server.stop()
        orphan = crash_actual_adapter(server, folder)
        check((server.folder / "uploads/.pending" / orphan).exists(), "SC_CRASH_JOURNAL_MISSING")
        server.start()
        wait(lambda: not (server.folder / "uploads/.pending" / orphan).exists() and not (server.folder / "uploads/.part" / orphan).exists())
        client = HttpClient(server)
        client.request("/api/auth/login", "POST", {"username": "recovery-author", "password": author_password}, expected=204, form=True)
        client.csrf = client.request("/api/auth/csrf")
        check(client.request(f'/api/requirements/{requirement["id"]}') == detail, "SC_CRASH_COMMITTED_DETAIL_CHANGED")
        check(fixture.raw(client, f'/api/files/{version["fileId"]}')[0] == image, "SC_CRASH_COMMITTED_IMAGE_CHANGED")
        passed(phase, actualAdapterChildKilled=True, orphanPartialRemoved=True)
        phase = "stop and backup single H2 uploads journal set"
        server.stop()
        backup = folder / "backup"
        command(["python3", str(ROOT / "scripts/backup-runtime.py"), "--runtime-root", str(server.folder), "--jar", str(server.jar), "--output", str(backup)])
        manifest = json.loads((backup / "manifest.json").read_text())
        check(len(manifest["migrations"]) == 7 and not any("secret" in row["file"] or "log" in row["file"] for row in manifest["files"]), "SC_BACKUP_SCHEMA_OR_SECRET_BOUNDARY")
        passed(phase, migrationCount=len(manifest["migrations"]), files=len(manifest["files"]))
        phase = "tampered hash path symlink build and nonempty target reject without source mutation"
        backup_hashes = {path.relative_to(backup).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in backup.rglob("*") if path.is_file()}
        tampered = folder / "tampered"
        shutil.copytree(backup, tampered)
        chosen = tampered / manifest["files"][0]["file"]
        with chosen.open("ab") as stream:
            stream.write(b"x")
        command(["python3", str(ROOT / "scripts/restore-runtime.py"), "--backup", str(tampered), "--runtime-root", str(folder / "rejected"), "--jar", str(server.jar)], expected=1)
        check(not (folder / "rejected").exists(), "SC_RESTORE_TAMPERED_WRITES")
        for probe in ("path", "symlink", "build"):
            hostile = folder / ("hostile-" + probe)
            shutil.copytree(backup, hostile)
            hostile_manifest = json.loads((hostile / "manifest.json").read_text())
            if probe == "path":
                hostile_manifest["files"][0]["file"] = "../escape.mv.db"
            elif probe == "symlink":
                selected = hostile / hostile_manifest["files"][0]["file"]
                selected.unlink()
                selected.symlink_to(folder / "outside-not-read")
            else:
                hostile_manifest["build"]["jarSha256"] = "0" * 64
            (hostile / "manifest.json").write_text(json.dumps(hostile_manifest))
            rejected = folder / ("reject-" + probe)
            command(["python3", str(ROOT / "scripts/restore-runtime.py"), "--backup", str(hostile), "--runtime-root", str(rejected), "--jar", str(server.jar)], expected=1)
            check(not rejected.exists(), "SC_RESTORE_HOSTILE_WRITES")
        command(["python3", str(ROOT / "scripts/restore-runtime.py"), "--backup", str(backup), "--runtime-root", str(server.folder), "--jar", str(server.jar)], expected=1)
        check(backup_hashes == {path.relative_to(backup).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in backup.rglob("*") if path.is_file()}, "SC_RESTORE_BACKUP_MUTATED")
        passed(phase, rejectionCases=5, backupImmutable=True)
        phase = "fresh empty root restore validates same schema build metadata bytes and inbox"
        restored = operations_server("reference", management_port=18489, shared_home=args.shared_home)
        restored.jar = stable_jar
        shutil.rmtree(restored.folder / "data")
        restore_stage = folder / "restored"
        command(["python3", str(ROOT / "scripts/restore-runtime.py"), "--backup", str(backup), "--runtime-root", str(restore_stage), "--jar", str(server.jar)])
        for entry in restore_stage.iterdir():
            entry.rename(restored.folder / entry.name)
        # 기존 DB의 synthetic identity를 재사용한다. private test 비밀번호를 출력하지 않는다.
        restored.password = server.password
        restored.secret.write_text(server.password)
        restored.secret.chmod(0o600)
        restored.extra_environment["SC_FRAMEWORK_MESSAGING_APPLICATIONID"] = server.extra_environment["SC_FRAMEWORK_MESSAGING_APPLICATIONID"]
        restored.start()
        restarted = HttpClient(restored)
        restarted.request("/api/auth/login", "POST", {"username": "recovery-author", "password": author_password}, expected=204, form=True)
        restarted.csrf = restarted.request("/api/auth/csrf")
        check(restarted.request("/api/auth/me")["id"] == actor["id"], "SC_RESTORE_IDENTITY_CHANGED")
        check(restarted.request(f'/api/requirements/{requirement["id"]}') == detail, "SC_RESTORE_DETAIL_CHANGED")
        attachment = detail["attachments"][0]
        check(fixture.raw(restarted, f'/api/files/{version["fileId"]}')[0] == image and fixture.raw(restarted, f'/api/files/{attachment["fileId"]}')[0] == pdf, "SC_RESTORE_BYTES_CHANGED")
        restore_admin = HttpClient(restored)
        restore_admin.login()
        restored_messages = restore_admin.request("/api/operations/messages?type=MESSAGE_DEMO&size=100")["items"]
        check(any(row["eventId"] == message["eventId"] and row["state"] == "COMPLETED" for row in restored_messages), "SC_RESTORE_INBOX_CHANGED")
        passed(phase, preservedRevision=2, sameImageSha256=hashlib.sha256(image).hexdigest(), samePdfSha256=hashlib.sha256(pdf).hexdigest())
        phase = "restored authored deletion commits FILE_DELETE outbox and preserves referenced original"
        pdf_keys = [path.name for path in (restored.folder / "uploads").iterdir() if path.is_file() and re.fullmatch(r"[0-9a-f-]{36}", path.name) and path.read_bytes() == pdf]
        check(len(pdf_keys) == 1, "SC_RESTORE_PDF_BLOB_COUNT")
        removed = restarted.request(f'/api/requirements/{requirement["id"]}/attachments/{attachment["id"]}?revision=2', "DELETE")
        check(removed["revision"] == 3 and not removed["attachments"], "SC_RESTORE_DELETE_REVISION")
        check(restarted.request(f'/api/files/{attachment["fileId"]}', expected=404)["code"] == "NOT_FOUND", "SC_RESTORE_DELETE_METADATA")
        wait(lambda: not (restored.folder / "uploads" / pdf_keys[0]).exists())
        check(fixture.raw(restarted, f'/api/files/{version["fileId"]}')[0] == image, "SC_RESTORE_DELETE_CHANGED_IMAGE")
        passed(phase, revision=3, durableDeleteCompleted=True, referencedOriginalPreserved=True)
    except Exception as failure:
        error = type(failure).__name__
        fixed_code = str(failure) if re.fullmatch(r"SC_[A-Z0-9_]{1,80}", str(failure)) else None
        checks.append({"name": phase, "passed": False, "exceptionType": error, "failureCode": fixed_code})
        print("FAIL " + phase + " (" + error + ")", flush=True)
    finally:
        cleanup = True
        for current in (restored, server):
            if current is not None:
                try:
                    try:
                        for log in current.folder.glob("*.log"):
                            content = log.read_bytes()
                            check(author_password.encode() not in content and current.password.encode() not in content, "SC_RECOVERY_CREDENTIAL_LOG")
                    finally:
                        current.cleanup()
                except Exception:
                    cleanup = False
        shutil.rmtree(folder, ignore_errors=True)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps({"stage": "012", "passed": error is None and cleanup, "checks": checks, "temporaryDirectoriesRemoved": cleanup, "originalRuntimeUsed": False, "crashScope": "actual LocalFileStorage child SIGKILL at partial-write boundary; confirm/ack JVM boundaries require separate test evidence and are not claimed here", "wholeSystemSnapshot": "stopped own H2/uploads/journal, same exact JAR and Flyway checksums"}, ensure_ascii=False, indent=2) + "\n")
    return 1 if error or not cleanup else 0


if __name__ == "__main__":
    raise SystemExit(main())
