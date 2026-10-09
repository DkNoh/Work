"""새로 생성한 외부 검증 앱만 업그레이드/롤백한다. 업무 소스와 같은 H2 자료를 보존한다."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import zipfile
from _harness import ROOT, JarServer, HttpClient

parser = argparse.ArgumentParser()
parser.add_argument("--consumer", required=True)
parser.add_argument("--from-artifacts", required=True)
parser.add_argument("--to-artifacts", required=True)
parser.add_argument("--label", default="second")
args = parser.parse_args()
assert args.label.replace("-", "").isalnum()
consumer = pathlib.Path(args.consumer).resolve(strict=True)
# 실제 사용자 앱은 검증 fixture로 선택할 수 없다.
assert consumer.is_relative_to(pathlib.Path("/private/tmp/sc-framework-consumer-011-20261007"))
assert not consumer.is_relative_to(ROOT)
assert (consumer / "sc-starter.lock.json").is_file()
output = ROOT / "docs/검증" / ("011-upgrade-rollback-" + args.label)
assert not output.exists(), "이전 실행 증거를 덮어쓸 수 없습니다."
output.mkdir(parents=True, exist_ok=True)
report = {"stage": "011", "passed": False, "phases": [], "appSourcePreserved": False,
          "sameH2Preserved": False, "originalRuntimeAccessed": False}
sha = lambda data: hashlib.sha256(data).hexdigest()


def source_hashes():
    files = [consumer / "sc-starter.lock.json"]
    for directory in ("frontend/src", "backend/src", "scripts", "docs"):
        files += [file for file in (consumer / directory).rglob("*") if file.is_file()]
    assert not any(file.is_symlink() for file in files)
    return {str(file.relative_to(consumer)): sha(file.read_bytes()) for file in sorted(files)
            if file != consumer / "docs/openapi.json"}


def api_contract():
    schema = json.loads((consumer / "docs/openapi.json").read_text())
    # 격리 API capture의 임의 loopback port만 계약 비교에서 제외한다.
    schema.pop("servers", None)
    return schema


def verify_release(folder, label):
    folder = pathlib.Path(folder).resolve(strict=True)
    result = subprocess.run(["node", str(ROOT / "scripts/verify-package-artifacts.mjs"),
                             "--artifacts", str(folder), "--report",
                             str(output / (label + "-artifacts.json"))], cwd=ROOT,
                            capture_output=True, text=True)
    (output / (label + "-artifacts.log")).write_text(result.stdout + result.stderr)
    assert result.returncode == 0
    return folder, json.loads((folder / "artifacts.json").read_text())


old_folder, old_release = verify_release(args.from_artifacts, "old")
new_folder, new_release = verify_release(args.to_artifacts, "new")
assert old_release["frameworkVersion"] != new_release["frameworkVersion"]
initial_sources = source_hashes()
initial_api = api_contract()
initial_lock = (consumer / "package-lock.json").read_bytes()
initial_package = (consumer / "package.json").read_bytes()
initial_pom = (consumer / "backend/pom.xml").read_bytes()
name = json.loads(initial_package)["name"]
jar = consumer / "backend/target" / (name + ".jar")
server = JarServer(jar, profile="dev")
env = os.environ.copy()
env["MAVEN_OPTS"] = "-Dmaven.repo.local=" + str(consumer / ".runtime/maven-repository")


def build(label, restore_lock=False):
    if not restore_lock:
        with (output / (label + "-install.log")).open("w") as log:
            result = subprocess.run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
                                    cwd=consumer, env=env, stdout=log, stderr=log)
        assert result.returncode == 0
    with (output / (label + "-build.log")).open("w") as log:
        result = subprocess.run(["bash", "scripts/build.sh"], cwd=consumer, env=env,
                                stdout=log, stderr=log)
    assert result.returncode == 0
    assert source_hashes() == initial_sources, "업무 소스/생성 provenance가 변경되었습니다."
    assert api_contract() == initial_api, "정규화한 실제 API 계약이 변경되었습니다."


def apply_release(folder, release):
    package = json.loads((consumer / "package.json").read_text())
    for item in release["frontend"]:
        relative = "vendor/npm/" + item["file"]
        data = (folder / item["file"]).read_bytes()
        assert sha(data) == item["sha256"]
        destination = consumer / relative
        assert not destination.is_symlink()
        if destination.exists():
            assert sha(destination.read_bytes()) == item["sha256"]
        else:
            destination.write_bytes(data)
        package["dependencies"][item["name"]] = "file:" + relative
    for item in release["backend"]["files"]:
        relative = "vendor/maven/" + item["file"].removeprefix("maven/")
        data = (folder / item["file"]).read_bytes()
        assert sha(data) == item["sha256"]
        destination = consumer / relative
        assert not any(parent.is_symlink() for parent in [destination, *destination.parents] if parent != consumer.parent)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            assert sha(destination.read_bytes()) == item["sha256"]
        else:
            destination.write_bytes(data)
    (consumer / "package.json").write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")
    pom = (consumer / "backend/pom.xml").read_text()
    pom, count = re.subn(r"(<parent>.*?<version>)[^<]+(</version>.*?</parent>)",
                        lambda match: match[1] + release["backend"]["version"] + match[2], pom, count=1, flags=re.S)
    assert count == 1
    (consumer / "backend/pom.xml").write_text(pom)


def installed_release(release):
    for item in release["frontend"]:
        package = json.loads((consumer / "node_modules" / item["name"] / "package.json").read_text())
        assert package["version"] == item["version"]
    with zipfile.ZipFile(jar) as archive:
        for item in release["backend"]["files"]:
            if item["file"].endswith(".jar"):
                data = archive.read("BOOT-INF/lib/" + pathlib.Path(item["file"]).name)
                assert sha(data) == item["sha256"]


try:
    installed_release(old_release)
    server.start()
    client = HttpClient(server)
    client.login()
    note = client.request("/api/notes", "POST", {"title": "upgrade rollback 보존_%!"})["item"]
    identifier = note["id"]
    report["phases"].append({"name": "old baseline", "version": old_release["frameworkVersion"], "revision": 1, "passed": True})
    server.stop()
    apply_release(new_folder, new_release)
    build("upgrade")
    installed_release(new_release)
    with (output / "upgrade-public-types.log").open("w") as log:
        types = subprocess.run(["node", str(ROOT / "scripts/verify-package-consumer.mjs"),
                                "--consumer", str(consumer), "--report",
                                str(ROOT / "docs/검증/011-consumer-types-v02.json")],
                               cwd=ROOT, stdout=log, stderr=log)
    assert types.returncode == 0
    server.start()
    client = HttpClient(server)
    client.login()
    retained = client.request("/api/notes/" + str(identifier))
    assert retained["title"] == note["title"] and retained["revision"] == 1
    note = client.request("/api/notes/" + str(identifier), "PUT", {"title": "upgrade 저장_%!", "revision": 1})["item"]
    assert note["revision"] == 2
    browser = subprocess.run(["node", str(ROOT / "scripts/verify-package-browser.mjs"),
                              "--base-url", server.base_url, "--secret-file", str(server.secret),
                              "--output", str(output / "browser-upgrade"), "--patterns", "on"], cwd=consumer)
    assert browser.returncode == 0
    report["phases"].append({"name": "upgrade", "version": new_release["frameworkVersion"],
                             "revision": 2, "exactCommonJarBytes": True, "appSourceChanged": 0, "passed": True})
    server.stop()
    # 이전 배포 artifact와 이전 manifest/lock을 그대로 재사용한다. 소스 downgrade를 하지 않는다.
    (consumer / "package.json").write_bytes(initial_package)
    (consumer / "package-lock.json").write_bytes(initial_lock)
    (consumer / "backend/pom.xml").write_bytes(initial_pom)
    build("rollback", restore_lock=True)
    installed_release(old_release)
    server.start()
    client = HttpClient(server)
    client.login()
    retained = client.request("/api/notes/" + str(identifier))
    assert retained["title"] == note["title"] and retained["revision"] == 2
    updated = client.request("/api/notes/" + str(identifier), "PUT", {"title": "rollback 저장_%!", "revision": 2})["item"]
    assert updated["revision"] == 3
    client.request("/api/notes/" + str(identifier), "PUT", {"title": "stale", "revision": 1}, expected=409)
    client.request("/api/auth/logout", "POST", expected=204)
    client.request("/api/notes", expected=401)
    assert source_hashes() == initial_sources
    assert (consumer / "package-lock.json").read_bytes() == initial_lock
    report["phases"].append({"name": "rollback", "version": old_release["frameworkVersion"],
                             "revision": 3, "exactCommonJarBytes": True, "exactOldLockRestored": True, "passed": True})
    report.update(passed=True, appSourcePreserved=True, protectedSourceFiles=len(initial_sources),
                  sameH2Preserved=True, normalizedApiUnchanged=True,
                  normalizedApiExcludedFields=["servers"],
                  compatibilityScope="same API/DDL, no destructive schema migration")
    print("PASS 0.1.0 -> 0.2.0 -> 0.1.0 actual builds, installed versions, same H2 and unchanged app source")
finally:
    server.stop()
    for log in server.folder.glob("process-*.log"):
        (output / log.name).write_text(log.read_text(errors="replace").replace(server.password, "<redacted>"))
    server.cleanup()
    report["temporaryRuntimeRemoved"] = not server.folder.exists()
    (output / "summary.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
