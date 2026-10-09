#!/usr/bin/env python3
"""분리된 운영 Playwright 서버. 공통 인프라를 제외한 H2/계정/로그는 임시 자료다."""
import json
import os
import signal
import sys
import pathlib
import uuid
import subprocess
import zipfile
from _harness import ROOT
from _operations_harness import operations_server

application = sys.argv[1] if len(sys.argv) > 1 else "reference"
if application not in ("reference", "starter"):
    raise SystemExit("Unknown application")
port = int(os.environ.get("SC_E2E_OPERATIONS_PORT" if application == "reference"
                          else "SC_E2E_OPERATIONS_STARTER_PORT", "18193" if application == "reference" else "18194"))
server = operations_server(application, port=port, management_port=18493 if application == "reference" else 18494)
metadata = ROOT / ".runtime" / ("e2e-operations.json" if application == "reference" else "e2e-operations-starter.json")
created = False
dead_event_id = str(uuid.uuid4())


def stop(*_):
    if server.process is not None and server.process.poll() is None:
        server.process.terminate()


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    server.start()
    # UI retry fixture만 생성한다. 최초 5회 실패/DLQ는 별도 실제 MQ 통합 검증에서 확인한다.
    server.stop()
    with zipfile.ZipFile(server.jar) as jar:
        name = next(name for name in jar.namelist() if name.startswith("BOOT-INF/lib/h2-") and name.endswith(".jar"))
        driver = server.folder / "h2-verifier.jar"
        driver.write_bytes(jar.read(name))
    java = os.environ.get("JAVA_BIN") or (str(pathlib.Path(os.environ["JAVA21_HOME"]) / "bin/java")
                                            if os.environ.get("JAVA21_HOME") else "java")
    sql = "INSERT INTO sc_message_outbox(event_id,type,schema_version,payload,payload_sha256,state,dispatch_attempts,handler_attempts,next_attempt_at,created_at,last_failure_code) VALUES ('" + dead_event_id + "','MESSAGE_DEMO',1,'{}','44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a','DEAD',1,5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'HANDLER_ATTEMPTS_EXHAUSTED')"
    seeded = subprocess.run([java, "-cp", str(driver), "org.h2.tools.Shell", "-url", f"jdbc:h2:file:{server.folder / 'data/test'};DB_CLOSE_ON_EXIT=FALSE", "-user", "sa", "-password", "", "-sql", sql], capture_output=True, text=True)
    if seeded.returncode or "Error" in seeded.stdout + seeded.stderr:
        raise RuntimeError("Could not prepare isolated retry UI fixture")
    driver.unlink()
    server.start()
    descriptor = os.open(metadata, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    created = True
    with os.fdopen(descriptor, "w") as stream:
        json.dump({"passwordFile": str(server.secret), "baseURL": server.base_url, "deadEventId": dead_event_id}, stream)
    raise SystemExit(server.process.wait())
finally:
    if created:
        metadata.unlink(missing_ok=True)
    server.cleanup()
