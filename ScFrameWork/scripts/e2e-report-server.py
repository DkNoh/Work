#!/usr/bin/env python3
"""별도 포트/새 H2의 bootstrap→offline 10k seed→재기동 수명을 관리한다."""
import importlib.util
import json
import os
import signal
from _harness import ROOT, JarServer

port = int(os.environ.get("SC_REPORT_E2E_PORT", "18185"))
if not 1024 <= port <= 65535 or port in (18183, 18184):
    raise SystemExit("일반 E2E와 분리된 유효한 report 포트를 사용해야 합니다.")
metadata = ROOT / ".runtime/e2e-reports.json"
server = JarServer(ROOT / "backend/reference-app/target/sc-reference-app.jar", port=0)
metadata_created = False
stopping = False


def stop(*_):
    global stopping
    stopping = True
    if server.process is not None and server.process.poll() is None:
        server.process.terminate()
    fixture_process = getattr(server, "report_fixture_process", None)
    if fixture_process is not None and fixture_process.poll() is None:
        fixture_process.terminate()


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    server.start()
    server.stop()
    if stopping:
        raise SystemExit(0)
    source = ROOT / "scripts/seed-report-fixture.py"
    spec = importlib.util.spec_from_file_location("sc_report_fixture", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fixture = module.seed_report_fixture(server)
    if stopping:
        raise SystemExit(0)
    # metadata를 먼저 생성한다. 고정 readiness 포트는 seed 이후에만 열린다.
    metadata.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(metadata, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    metadata_created = True
    with os.fdopen(descriptor, "w") as stream:
        json.dump({"passwordFile": str(server.secret), "baseURL": f"http://127.0.0.1:{port}", "fixture": fixture}, stream, ensure_ascii=False)
    server.port = port
    server.start()
    # 실제 보고서 API 검증은 전용 Playwright에서 admin/일반 사용자로 수행한다.
    print("PASS isolated report fixture bootstrap/offline seed/restart; 10000 synthetic rows ready", flush=True)
    raise SystemExit(server.process.wait())
finally:
    if metadata_created:
        metadata.unlink(missing_ok=True)
    server.cleanup()
