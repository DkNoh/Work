"""정지된 Sc runtime만 다룬다. 원본 프로젝트·secret·로그·파일 내용은 출력하지 않는다."""
import contextlib
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile


class BackupError(RuntimeError):
    pass


def fail(code):
    raise BackupError(code)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def safe_root(value):
    lexical = pathlib.Path(value).absolute()
    if lexical.is_symlink():
        fail("SC_BACKUP_ROOT_SYMLINK")
    root = lexical.resolve()
    if any(character in str(root) for character in (";", "\r", "\n", "\x00")):
        fail("SC_BACKUP_ROOT_INVALID")
    for forbidden in (pathlib.Path("/Users/dk/Work/WorkboardVue"), pathlib.Path("/Users/dk/Work/workboard")):
        if root == forbidden or forbidden in root.parents:
            fail("SC_BACKUP_REFERENCE_RUNTIME_FORBIDDEN")
    return root


@contextlib.contextmanager
def runtime_lock(root):
    if not root.is_dir():
        fail("SC_BACKUP_RUNTIME_MISSING")
    lock = root / ".sc-runtime.lock"
    if lock.is_symlink():
        fail("SC_BACKUP_LOCK_INVALID")
    descriptor = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.lockf(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB, 1, 0)
        except BlockingIOError:
            fail("SC_BACKUP_RUNTIME_ACTIVE")
        yield
    finally:
        os.close(descriptor)


def jar_metadata(jar):
    if not jar.is_file() or jar.is_symlink():
        fail("SC_BACKUP_JAR_INVALID")
    with zipfile.ZipFile(jar) as archive:
        try:
            manifest = archive.read("META-INF/MANIFEST.MF").decode("utf-8")
        except (KeyError, UnicodeError):
            fail("SC_BACKUP_BUILD_METADATA_INVALID")
    match = re.search(r"^Implementation-Version: ([A-Za-z0-9_.-]{1,80})\r?$", manifest, re.M)
    if not match:
        fail("SC_BACKUP_BUILD_METADATA_INVALID")
    return {"jarSha256": digest(jar), "implementationVersion": match.group(1)}


def schema_evidence(root, db_relative, jar):
    java = os.environ.get("JAVA_BIN")
    if not java:
        java = str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java") if os.environ.get("JAVA21_HOME") else "java"
    environment = {key: value for key, value in os.environ.items() if key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS")}
    version = subprocess.run([java, "-version"], capture_output=True, env=environment, timeout=15, check=False)
    if version.returncode or not re.search(rb'version "21(?:\.|\")', version.stdout + version.stderr):
        fail("SC_BACKUP_JDK21_REQUIRED")
    with tempfile.TemporaryDirectory(prefix="sc-backup-schema-") as folder:
        runtime = pathlib.Path(folder) / "h2.jar"
        with zipfile.ZipFile(jar) as archive:
            matches = [info for info in archive.infolist() if re.fullmatch(r"BOOT-INF/lib/h2-[0-9.]+\.jar", info.filename)]
            if len(matches) != 1 or matches[0].file_size > 20_000_000:
                fail("SC_BACKUP_H2_RUNTIME_INVALID")
            runtime.write_bytes(archive.read(matches[0]))
        database = root / db_relative
        # IFEXISTS/read-only를 명시해 오타가 새 DB를 생성하거나 원본을 수정하지 않게 한다.
        base = str(database)[:-6]
        query = 'SELECT CONCAT("version",\'|\',"script",\'|\',"checksum",\'|TRUE\') FROM "flyway_schema_history" WHERE "type"=\'SQL\' AND "success"=TRUE ORDER BY "installed_rank"'
        command = [java, "-cp", str(runtime), "org.h2.tools.Shell", "-url", "jdbc:h2:file:" + base + ";IFEXISTS=TRUE;ACCESS_MODE_DATA=r", "-user", "sa", "-sql", query]
        result = subprocess.run(command, capture_output=True, env=environment, timeout=30, check=False)
        if result.returncode or len(result.stdout) > 1_000_000 or result.stderr:
            fail("SC_BACKUP_SCHEMA_READ_FAILED")
        migrations = []
        for line in result.stdout.decode("utf-8", errors="replace").splitlines():
            candidate = line.strip()
            if re.fullmatch(r"[0-9]+(?:\.[0-9]+)*\|[A-Za-z0-9_.-]{1,200}\|-?[0-9]+\|TRUE", candidate):
                version, script, checksum, _ = candidate.split("|")
                migrations.append({"version": version, "script": script, "checksum": int(checksum)})
        if not migrations:
            fail("SC_BACKUP_SCHEMA_EMPTY")
        return migrations


def inventory(root):
    entries = []
    data = root / "data"
    if not data.is_dir() or data.is_symlink():
        fail("SC_BACKUP_DATABASE_MISSING")
    databases = []
    for path in sorted(data.iterdir()):
        if path.is_symlink() or not path.is_file():
            fail("SC_BACKUP_DATABASE_ENTRY_INVALID")
        if path.name.endswith(".lock.db"):
            fail("SC_BACKUP_DATABASE_ACTIVE")
        if re.fullmatch(r"[A-Za-z0-9_.-]+\.mv\.db", path.name):
            databases.append(path)
        elif not path.name.endswith(".trace.db"):
            fail("SC_BACKUP_DATABASE_ENTRY_INVALID")
    if len(databases) != 1:
        fail("SC_BACKUP_DATABASE_COUNT_INVALID")
    paths = list(databases)
    uploads = root / "uploads"
    if uploads.exists():
        if uploads.is_symlink() or not uploads.is_dir():
            fail("SC_BACKUP_UPLOADS_INVALID")
        for path in sorted(uploads.rglob("*")):
            relative = path.relative_to(uploads)
            if path.is_symlink():
                fail("SC_BACKUP_UPLOAD_SYMLINK")
            if path.is_dir():
                if str(relative) not in (".pending", ".part"):
                    fail("SC_BACKUP_UPLOAD_DIRECTORY_INVALID")
                continue
            if str(relative) == ".sc-storage.lock":
                continue
            if not path.is_file() or not valid_relative("uploads/" + relative.as_posix()):
                fail("SC_BACKUP_UPLOAD_ENTRY_INVALID")
            paths.append(path)
    total = 0
    for path in paths:
        size = path.stat().st_size
        if size > 2_000_000_000:
            fail("SC_BACKUP_FILE_LIMIT")
        total += size
        if total > 4_000_000_000 or len(paths) > 20000:
            fail("SC_BACKUP_SET_LIMIT")
        entries.append({"file": path.relative_to(root).as_posix(), "size": size, "sha256": digest(path)})
    return databases[0].relative_to(root).as_posix(), entries


def valid_relative(value):
    if not isinstance(value, str) or "\\" in value:
        return False
    key = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    return bool(re.fullmatch(r"data/[A-Za-z0-9_.-]+\.mv\.db", value) or re.fullmatch(r"uploads/(?:\.pending/|\.part/)?" + key, value))


def validate_set(root, manifest):
    if not isinstance(manifest, dict) or set(manifest) != {"format", "createdAt", "build", "database", "migrations", "files"} or type(manifest["format"]) is not int or manifest["format"] != 1:
        fail("SC_RESTORE_MANIFEST_INVALID")
    entries = manifest["files"]
    if not isinstance(entries, list) or not entries or len(entries) > 20000 or not isinstance(manifest["migrations"], list) or not manifest["migrations"]:
        fail("SC_RESTORE_MANIFEST_INVALID")
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"file", "size", "sha256"} or not valid_relative(entry["file"]) or entry["file"] in seen:
            fail("SC_RESTORE_PATH_INVALID")
        seen.add(entry["file"])
        path = root / entry["file"]
        if any(parent.is_symlink() for parent in [path, *path.parents] if parent == root or root in parent.parents) or not path.is_file():
            fail("SC_RESTORE_ENTRY_INVALID")
        if type(entry["size"]) is not int or entry["size"] < 0 or path.stat().st_size != entry["size"] or not re.fullmatch(r"[0-9a-f]{64}", str(entry["sha256"])) or digest(path) != entry["sha256"]:
            fail("SC_RESTORE_HASH_MISMATCH")
    expected = seen | {"manifest.json"}
    actual = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            fail("SC_RESTORE_ENTRY_INVALID")
        if path.is_file():
            actual.add(path.relative_to(root).as_posix())
    if actual != expected or manifest["database"] not in seen:
        fail("SC_RESTORE_INVENTORY_MISMATCH")


def private_copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copyfile(source, target, follow_symlinks=False)
    target.chmod(0o600)
    with target.open("rb") as stream:
        os.fsync(stream.fileno())


def write_json(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
