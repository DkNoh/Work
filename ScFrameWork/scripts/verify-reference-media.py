#!/usr/bin/env python3
"""자기 임시 Reference H2/uploads의 clean stop/start 후 미디어 영속성을 검증한다."""
import argparse
import hashlib
import json
import pathlib
import re
import secrets
import socket
import stat
import struct
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zlib

from _harness import ROOT, HttpClient, JarServer


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def synthetic_png():
    """표준 라이브러리만으로 만든 4x3 RGB 이미지이며 실제 사진은 사용하지 않는다."""
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    pixels = b"".join(b"\x00" + bytes(value for x in range(4) for value in (x * 50, y * 60, 80))
                      for y in range(3))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 3, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b""))


def synthetic_pdf():
    """개인 내용 없는 한 페이지 PDF의 object/xref를 직접 합성한다."""
    objects = (
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Resources << >> >>\nendobj\n",
    )
    content = bytearray(b"%PDF-1.7\n")
    offsets = []
    for item in objects:
        offsets.append(len(content))
        content.extend(item)
    start = len(content)
    content.extend(b"xref\n0 4\n0000000000 65535 f \n")
    for offset in offsets:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    content.extend(f"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode("ascii"))
    return bytes(content)


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
    # 오류에는 요청/응답·cookie·CSRF·합성 자격 증명을 출력하지 않는다.
    check(status == expected, "Media HTTP response did not match its expected safe status")
    return content, response_headers


def upload(client, path, payload, filename, mime, expected=200, csrf=True):
    boundary = "sc-media-restart-" + uuid.uuid4().hex
    prefix = ("--" + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="'
              + filename + '"\r\nContent-Type: ' + mime + '\r\n\r\n').encode("ascii")
    body = prefix + payload + ("\r\n--" + boundary + "--\r\n").encode("ascii")
    content, _ = raw(client, path, "POST", body, "multipart/form-data; boundary=" + boundary, expected, csrf)
    return json.loads(content)


def login_author(server, password):
    client = HttpClient(server)
    client.request("/api/auth/login", "POST", {"username": "media-restart-author", "password": password},
                   expected=204, form=True)
    client.csrf = client.request("/api/auth/csrf")
    identity = client.request("/api/auth/me")
    check(identity.get("role") == "REQUESTER", "Synthetic author identity did not come from the database")
    return client, identity["id"]


def stored_bytes(server):
    root = server.folder / "uploads"
    check(root.is_dir(), "The isolated uploads root is missing")
    entries = {}
    for path in root.iterdir():
        check(path.is_file() and not path.is_symlink() and re.fullmatch(r"[0-9a-f-]{36}", path.name),
              "Storage contains an unexpected file entry")
        entries[path.name] = path.read_bytes()
    return entries


def stop_cleanly(server):
    process = server.process
    address = urllib.parse.urlsplit(server.base_url)
    server.stop()
    check(process.returncode in (0, 143, -15), "Reference did not complete its normal TERM shutdown")
    with socket.socket() as probe:
        probe.settimeout(0.2)
        check(probe.connect_ex((address.hostname, address.port)) != 0, "Reference port remained open after shutdown")


def assert_no_credentials(server, author_password):
    for path in server.folder.glob("*.log"):
        content = path.read_bytes()
        check(server.password.encode() not in content and author_password.encode() not in content,
              "Synthetic credentials appeared in runtime output")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", type=pathlib.Path, default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
    parser.add_argument("--log", type=pathlib.Path, default=ROOT / "docs/검증/010-reference-media-restart.log")
    parser.add_argument("--report", type=pathlib.Path, default=ROOT / "docs/검증/010-reference-media-restart.json")
    args = parser.parse_args()
    server = None
    checks = []
    phase = "isolated fixture preparation"
    failed = False
    author_password = secrets.token_urlsafe(24)
    image = synthetic_png()
    pdf = synthetic_pdf()
    def passed(name, **metadata):
        checks.append({"name": name, "passed": True, **metadata})
        print("PASS " + name, flush=True)
    try:
        server = JarServer(args.jar, profile="", launcher=False)
        check(stat.S_IMODE(server.secret.stat().st_mode) == 0o600, "Bootstrap secret permissions differ from 600")
        phase = "create synthetic author/menu/screen through actual session and CSRF HTTP"
        server.start()
        check(not (server.folder / "uploads").exists(), "Uploads root was created before first write")
        admin = HttpClient(server)
        admin.login()
        author = admin.request("/api/users", "POST", {"username": "media-restart-author", "displayName": "Synthetic media author",
                                                      "password": author_password, "role": "REQUESTER"})
        menu = admin.request("/api/menus", "POST", {"name": "Synthetic media menu", "sortOrder": 0})
        screen = admin.request("/api/screens", "POST", {"menuId": menu["id"], "name": "Synthetic original screen"})
        client, actor_id = login_author(server, author_password)
        check(actor_id == author["id"], "The created author and authenticated database actor differ")
        passed("session/CSRF creation of independent H2 author/menu/screen")
        phase = "create original image version/normalized requirement/PDF attachment"
        denied = upload(client, f'/api/screens/{screen["id"]}/versions', image, "fixture.png", "image/png", 403, False)
        check(denied.get("code") == "CSRF", "Version upload accepted a missing CSRF token")
        version = upload(client, f'/api/screens/{screen["id"]}/versions', image, "fixture.png", "application/x-fake")
        check(version["version"] == 1 and version["width"] == 4 and version["height"] == 3 and version["archived"] == 0,
              "Actual image decoding/version metadata changed")
        requirement = client.request("/api/requirements", "POST", {"title": "Synthetic image requirement", "menuId": menu["id"],
                          "desired": "Synthetic content", "reason": "Synthetic reason", "referenceText": "", "similar": False,
                          "followParts": "", "screenVersionId": version["id"], "annotation": {"x": .1, "y": .2, "width": .3, "height": .4}, "revision": 1})
        requirement_id = requirement["id"]
        before = upload(client, f'/api/requirements/{requirement_id}/attachments?revision=1', pdf, "fixture.pdf", "application/x-fake")
        check(before["revision"] == 2 and before["status"] == "DRAFT" and before["screenVersionId"] == version["id"],
              "Attachment write did not preserve the original requirement/version contract")
        check(before["annotation"] == requirement["annotation"] and len(before["attachments"]) == 1,
              "Annotation or single attachment metadata changed")
        attachment = before["attachments"][0]
        check(attachment["mime"] == "application/pdf" and attachment["size"] == len(pdf), "PDF metadata trusted its supplied fake MIME")
        for file_id, payload, mime in ((version["fileId"], image, "image/png"), (attachment["fileId"], pdf, "application/pdf")):
            content, headers = raw(client, f"/api/files/{file_id}")
            check(content == payload and headers.get("Content-Type") == mime and headers.get("Cache-Control") == "no-store",
                  "Authenticated original file bytes/headers changed before restart")
        blobs_before = stored_bytes(server)
        check(len(blobs_before) == 2 and set(blobs_before.values()) == {image, pdf}, "The isolated root did not contain exactly the two originals")
        pdf_key = next(key for key, content in blobs_before.items() if content == pdf)
        image_key = next(key for key, content in blobs_before.items() if content == image)
        passed("actual PNG/normalized box/PDF metadata and original bytes persisted", revision=2, blobs=2)
        phase = "clean stop/start reuses only its own H2/uploads and private bootstrap secret"
        assert_no_credentials(server, author_password)
        stop_cleanly(server)
        check((server.folder / "data/test.mv.db").is_file(), "Its own H2 file did not survive clean shutdown")
        check(stored_bytes(server) == blobs_before, "Clean shutdown removed Reference durable originals")
        server.start()
        client, restarted_actor = login_author(server, author_password)
        check(restarted_actor == actor_id, "Restart changed the stored author identity")
        after = client.request(f"/api/requirements/{requirement_id}")
        check(after == before, "Persisted requirement/detail/revision metadata changed across clean restart")
        versions = client.request(f'/api/screens/{screen["id"]}/versions')
        check(versions == [version], "Immutable original version metadata changed across clean restart")
        check(stored_bytes(server) == blobs_before, "Original blob names/bytes changed across clean restart")
        for file_id, payload in ((version["fileId"], image), (attachment["fileId"], pdf)):
            check(raw(client, f"/api/files/{file_id}")[0] == payload, "Authenticated original bytes changed across clean restart")
        passed("same isolated H2/uploads clean restart preserved identity/detail/revision/version/bytes", starts=2, revision=2)
        phase = "author-only attachment deletion removes only committed PDF and preserves original image"
        restarted_admin = HttpClient(server)
        restarted_admin.login()
        rejected = restarted_admin.request(f'/api/requirements/{requirement_id}/attachments/{attachment["id"]}?revision=2', "DELETE", expected=403)
        check(rejected.get("code") == "FORBIDDEN", "ADMIN bypassed author-only attachment deletion")
        check(stored_bytes(server) == blobs_before, "Rejected deletion modified stored originals")
        deleted = client.request(f'/api/requirements/{requirement_id}/attachments/{attachment["id"]}?revision=2', "DELETE")
        check(deleted["revision"] == 3 and deleted["attachments"] == [] and deleted["annotation"] == before["annotation"],
              "Committed attachment deletion changed unrelated metadata or revision")
        check(client.request(f'/api/files/{attachment["fileId"]}', expected=404).get("code") == "NOT_FOUND",
              "Deleted file metadata was still readable")
        check(not (server.folder / "uploads" / pdf_key).exists(), "After-commit deletion left its PDF blob")
        check(stored_bytes(server) == {image_key: image}, "Attachment deletion removed or changed the immutable original image")
        check(raw(client, f'/api/files/{version["fileId"]}')[0] == image, "Remaining image was not readable after attachment deletion")
        passed("author-only committed deletion/file404/PDF cleanup with unchanged image", revision=3, remainingBlobs=1)
        phase = "final normal shutdown and credential-free logs"
        assert_no_credentials(server, author_password)
        stop_cleanly(server)
        check(stored_bytes(server) == {image_key: image}, "Final Reference shutdown removed its persistent original image")
        passed("normal final shutdown keeps durable image and prints no synthetic credential")
    except Exception as error:
        failed = True
        checks.append({"name": phase, "passed": False, "exceptionType": type(error).__name__})
        print("FAIL " + phase + " (" + type(error).__name__ + ")", flush=True)
    finally:
        cleanup_ok = True
        if server is not None:
            try:
                server.cleanup()
                cleanup_ok = not server.folder.exists()
            except Exception:
                cleanup_ok = False
        failed = failed or not cleanup_ok
        report = {"stage": "010", "passed": not failed, "checks": checks, "groups": len([item for item in checks if item["passed"]]),
                  "temporaryDirectoryRemoved": cleanup_ok, "originalRuntimeUsed": False, "syntheticFixturesOnly": True,
                  "syntheticCredentialsPrinted": None if failed else False,
                  "imageFixtureSha256": hashlib.sha256(image).hexdigest(), "pdfFixtureSha256": hashlib.sha256(pdf).hexdigest(),
                  "verificationScope": "clean stop/start in the same isolated H2/uploads; crash and backup/restore not verified"}
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text("\n".join(("PASS " if item["passed"] else "FAIL ") + item["name"] for item in checks) + "\n", encoding="utf-8")
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
