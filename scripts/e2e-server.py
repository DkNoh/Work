#!/usr/bin/env python3
"""Playwright가 소유하는 임시 H2/JAR 서버. 종료 시 계정과 생성 자료를 정리한다."""
import json
import os
import signal
import sys
from _harness import ROOT, JarServer

application = sys.argv[1] if len(sys.argv) > 1 else "reference"
if application not in ("reference", "starter"):
    raise SystemExit("검증 앱은 reference 또는 starter여야 합니다.")
port_variable = "SC_E2E_PORT" if application == "reference" else "SC_E2E_STARTER_PORT"
default_port = "18183" if application == "reference" else "18184"
server = JarServer(
    os.environ.get(
        f"SC_E2E_{application.upper()}_JAR",
        ROOT / f"backend/{application}-app/target/sc-{application}-app.jar",
    ),
    port=int(os.environ.get(port_variable, default_port)),
)
metadata_name = "e2e.json" if application == "reference" else "e2e-starter.json"
metadata = ROOT / ".runtime" / metadata_name
metadata_created = False


def stop(*_):
    if server.process is not None and server.process.poll() is None:
        server.process.terminate()


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    server.start()
    metadata.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(metadata, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    metadata_created = True
    with os.fdopen(descriptor, "w") as stream:
        json.dump({"passwordFile": str(server.secret), "baseURL": server.base_url}, stream)
    raise SystemExit(server.process.wait())
finally:
    if metadata_created:
        metadata.unlink(missing_ok=True)
    server.cleanup()
