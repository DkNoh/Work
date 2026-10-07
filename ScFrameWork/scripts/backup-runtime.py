"""정지 H2+uploads/journal만 private single set으로 백업한다. 기존 output은 덮어쓰지 않는다."""
import argparse
import datetime
import pathlib
import shutil
import sys
import tempfile
from _runtime_backup import BackupError, fail, inventory, jar_metadata, private_copy, runtime_lock, safe_root, schema_evidence, validate_set, write_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--jar", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = safe_root(args.runtime_root)
    output = safe_root(args.output)
    jar = pathlib.Path(args.jar).resolve()
    if output.exists() or output == root or root in output.parents or output in root.parents:
        fail("SC_BACKUP_OUTPUT_MUST_BE_NEW")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = pathlib.Path(tempfile.mkdtemp(prefix=".sc-backup-", dir=output.parent))
    stage.chmod(0o700)
    try:
        with runtime_lock(root):
            database, files = inventory(root)
            migrations = schema_evidence(root, database, jar)
            # read-only H2를 닫은 다음 고정된 source inventory를 다시 확인한다.
            after_database, after_files = inventory(root)
            if database != after_database or files != after_files:
                fail("SC_BACKUP_SOURCE_CHANGED")
            for entry in files:
                private_copy(root / entry["file"], stage / entry["file"])
            manifest = {"format": 1, "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "build": jar_metadata(jar), "database": database, "migrations": migrations, "files": files}
            write_json(stage / "manifest.json", manifest)
            validate_set(stage, manifest)
            stage.rename(output)
        print("SC_BACKUP_COMPLETE files=" + str(len(files)))
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == "__main__":
    try:
        main()
    except (BackupError, OSError, ValueError):
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, BackupError) else "SC_BACKUP_IO_FAILURE", file=sys.stderr)
        sys.exit(1)
