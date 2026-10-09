"""검증된 백업을 새 빈 root에만 복원한다. secret/로그 복제·원본 DB 편집을 하지 않는다."""
import argparse
import json
import pathlib
import shutil
import sys
import tempfile
from _runtime_backup import BackupError, fail, jar_metadata, private_copy, safe_root, schema_evidence, validate_set, write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup", required=True)
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--jar", required=True)
    args = parser.parse_args()
    backup = safe_root(args.backup)
    target = safe_root(args.runtime_root)
    jar = pathlib.Path(args.jar).resolve()
    if target == backup or backup in target.parents or target in backup.parents or target.exists() and (not target.is_dir() or any(target.iterdir())):
        fail("SC_RESTORE_TARGET_MUST_BE_EMPTY")
    manifest_path = backup / "manifest.json"
    if manifest_path.is_symlink() or not manifest_path.is_file() or manifest_path.stat().st_size > 10_000_000:
        fail("SC_RESTORE_MANIFEST_INVALID")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_set(backup, manifest)
    if manifest["build"] != jar_metadata(jar):
        fail("SC_RESTORE_BUILD_MISMATCH")
    target.parent.mkdir(parents=True, exist_ok=True)
    stage = pathlib.Path(tempfile.mkdtemp(prefix=".sc-restore-", dir=target.parent))
    stage.chmod(0o700)
    try:
        for entry in manifest["files"]:
            private_copy(backup / entry["file"], stage / entry["file"])
        write_json(stage / "manifest.json", manifest)
        validate_set(stage, manifest)
        if schema_evidence(stage, manifest["database"], jar) != manifest["migrations"]:
            fail("SC_RESTORE_SCHEMA_MISMATCH")
        # backup manifest는 복구 provenance로 보존하며 app에는 secret을 새로 제공한다.
        (stage / "manifest.json").rename(stage / "restore-manifest.json")
        stage.replace(target)
        print("SC_RESTORE_COMPLETE files=" + str(len(manifest["files"])))
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == "__main__":
    try:
        main()
    except (BackupError, OSError, ValueError):
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, BackupError) else "SC_RESTORE_IO_FAILURE", file=sys.stderr)
        sys.exit(1)
