"""외부 배포 세트를 소비하는 실제 JAR·H2·브라우저를 검사한다. 원본 자료는 사용하지 않는다."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import zipfile
from _harness import ROOT, JarServer, HttpClient

parser = argparse.ArgumentParser()
parser.add_argument("--consumer", required=True)
parser.add_argument("--label", required=True)
parser.add_argument("--patterns", choices=("on", "off"), default="on")
args = parser.parse_args()
assert args.label.replace("-", "").isalnum()
consumer = pathlib.Path(args.consumer).resolve(strict=True)
assert not consumer.is_relative_to(ROOT)
manifest = json.loads((consumer / "package.json").read_text())
jar = consumer / "backend" / "target" / (manifest["name"] + ".jar")
stage = os.environ.get("SC_EVIDENCE_STAGE", "011")
assert len(stage) == 3 and stage.isdigit()
output = ROOT / "docs" / "검증" / (stage + "-generated-" + args.label)
output.mkdir(parents=True, exist_ok=True)
report = {"stage": stage, "passed": False, "consumer": str(consumer), "groups": [], "originalRuntimeAccessed": False}
server = JarServer(jar, profile="dev")
try:
    with zipfile.ZipFile(jar) as archive:
        names = archive.namelist()
        assert not any("dev/scframework/reference" in name for name in names)
        expected = {"BOOT-INF/classes/static/" + str(file.relative_to(consumer / "frontend/dist")): file.read_bytes() for file in (consumer / "frontend/dist").rglob("*") if file.is_file()}
        actual = {name for name in names if name.startswith("BOOT-INF/classes/static/") and not name.endswith("/")}
        assert actual == set(expected)
        assert all(archive.read(name) == data for name, data in expected.items())
        framework_jars = [name for name in names if "/framework-" in name and name.endswith(".jar")]
        assert len(framework_jars) == 3
        report["jar"] = {"sha256": hashlib.sha256(jar.read_bytes()).hexdigest(), "staticFiles": len(expected), "exactDistBytes": True, "frameworkJars": framework_jars, "referenceClasses": 0}
    server.start()
    assert server.secret.stat().st_mode & 0o777 == 0o600
    anonymous = HttpClient(server)
    anonymous.request("/api/notes", expected=401)
    schema = anonymous.request("/v3/api-docs")
    assert "/api/notes" in schema["paths"]
    assert not any(path.startswith(("/api/requirements", "/api/kanban", "/api/storage-demo")) for path in schema["paths"])
    client = HttpClient(server)
    client.login()
    client.request("/api/notes", "POST", {"title": "no csrf"}, expected=403, csrf=False)
    client.request("/api/notes", "POST", {"title": " "}, expected=400)
    first = client.request("/api/notes", "POST", {"title": "외부 H2 조회_%!"})
    assert first["item"]["revision"] == 1 and first["stats"]["total"] == 1
    identifier = first["item"]["id"]
    second = client.request("/api/notes/" + str(identifier), "PUT", {"title": "외부 H2 저장_%!", "revision": 1})
    assert second["item"]["revision"] == 2 and second["stats"]["highestRevision"] == 2
    conflict = client.request("/api/notes/" + str(identifier), "PUT", {"title": "stale", "revision": 1}, expected=409)
    assert conflict["code"] == "REVISION_CONFLICT"
    page = client.request("/api/notes?q=_%25%21&page=0&size=20")
    assert page["total"] == 1
    report["groups"].append({"name": "real H2/JPA/Querydsl/MyBatis flush, session/CSRF/validation/revision", "passed": True})
    server.stop()
    server.start()
    restarted = HttpClient(server)
    restarted.login()
    assert restarted.request("/api/notes/" + str(identifier))["title"] == "외부 H2 저장_%!"
    report["groups"].append({"name": "clean process restart retains app-owned H2 notes", "passed": True})
    command = ["node", str(ROOT / "scripts/verify-package-browser.mjs"), "--base-url", server.base_url, "--secret-file", str(server.secret), "--output", str(output / "browser"), "--patterns", args.patterns]
    browser = subprocess.run(command, cwd=consumer, check=False)
    assert browser.returncode == 0, "External generated-app browser checks failed"
    report["browser"] = json.loads((output / "browser/summary.json").read_text())
    report["passed"] = True
    print("PASS standalone JAR, real H2 restart, security/API and installed-library browser")
finally:
    server.stop()
    for log in server.folder.glob("process-*.log"):
        text = log.read_text(errors="replace").replace(server.password, "<redacted>")
        (output / log.name).write_text(text)
    server.cleanup()
    report["temporaryRuntimeRemoved"] = not server.folder.exists()
    (output / "summary.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
