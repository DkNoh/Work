#!/usr/bin/env python3
"""실행 JAR를 건드리지 않고 빌드된 프런트를 별도 검증용 JAR로 포장한다."""
import argparse
import hashlib
import json
import pathlib
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", required=True, type=pathlib.Path)
    parser.add_argument("--frontend", required=True, type=pathlib.Path)
    parser.add_argument("--output", required=True, type=pathlib.Path)
    options = parser.parse_args()
    source = options.jar.resolve(strict=True)
    frontend = options.frontend.resolve(strict=True)
    output = options.output.resolve()
    if output.exists() or output == source:
        parser.error("새 후보 경로만 사용할 수 있습니다. 기존 JAR는 덮어쓰지 않습니다.")
    if not (frontend / "index.html").is_file():
        parser.error("먼저 소비 앱 프런트를 빌드하세요.")
    files = sorted(path for path in frontend.rglob("*") if path.is_file())
    if any(path.is_symlink() for path in frontend.rglob("*")):
        parser.error("프런트 산출물에 symlink를 넣을 수 없습니다.")
    if any(path.suffix in (".secret", ".db", ".key", ".pem") for path in files):
        parser.error("프런트 산출물에 실행 자료를 넣을 수 없습니다.")
    output.parent.mkdir(parents=True, exist_ok=True)
    original_sha = sha(source.read_bytes())
    prefix = "BOOT-INF/classes/static/"
    retained = {}
    static = {}
    try:
        with output.open("xb") as stream, zipfile.ZipFile(source) as old, zipfile.ZipFile(stream, "w") as candidate:
            if len(old.namelist()) != len(set(old.namelist())):
                parser.error("원본 JAR에 중복 entry가 있습니다.")
            for entry in old.infolist():
                if entry.filename.startswith(prefix):
                    continue
                contents = old.read(entry)
                retained[entry.filename] = sha(contents)
                # Spring Boot nested JAR의 STORED 방식과 ZIP metadata를 그대로 유지한다.
                candidate.writestr(entry, contents)
            for path in files:
                name = prefix + path.relative_to(frontend).as_posix()
                contents = path.read_bytes()
                candidate.writestr(name, contents, compress_type=zipfile.ZIP_DEFLATED)
                static[name] = sha(contents)
        with zipfile.ZipFile(output) as candidate:
            actual = {name: sha(candidate.read(name)) for name in candidate.namelist()}
            if actual != {**retained, **static} or candidate.testzip() is not None:
                raise RuntimeError("별도 후보의 JAR entry 검증에 실패했습니다.")
        if sha(source.read_bytes()) != original_sha:
            raise RuntimeError("원본 JAR SHA가 변경되었습니다.")
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    record = {
        "passed": True,
        "purpose": "UI-only candidate; backend classes and dependencies are unchanged",
        "sourceJar": str(source),
        "sourceSHA256": original_sha,
        "originalUnchanged": True,
        "candidate": str(output),
        "candidateSHA256": sha(output.read_bytes()),
        "preservedNonStaticEntries": len(retained),
        "staticFiles": len(static),
    }
    output.with_suffix(".json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record))


if __name__ == "__main__":
    main()
