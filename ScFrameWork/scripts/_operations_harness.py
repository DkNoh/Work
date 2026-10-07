"""테스트마다 새 H2/계정/운영 lock을 사용하고 공유 인프라의 private 연결 secret만 읽는다."""
import os
import pathlib
import shutil
import uuid
from _harness import ROOT, JarServer


def operations_server(application="reference", port=0, management_port=18482, shared_home=None):
    if application not in ("reference", "starter"):
        raise ValueError("Unknown consumer application")
    source = pathlib.Path(shared_home or os.environ.get("SC_OPERATIONS_HOME", ROOT / ".runtime/operations")).resolve()
    source = source / "secrets/operations"
    server = JarServer(ROOT / f"backend/{application}-app/target/sc-{application}-app.jar",
                       port=port, profile="dev,operations", extra_environment={
                           "SC_MANAGEMENT_PORT": str(management_port),
                           "SC_MANAGEMENT_ADDRESS": "0.0.0.0",
                           "SC_MQ_PORT": os.environ.get("SC_MQ_PORT", "5679"),
                           "SC_OTLP_ENDPOINT": "http://127.0.0.1:4319/v1/traces",
                           "SC_FRAMEWORK_MESSAGING_APPLICATIONID": "test-" + ("ref-" if application == "reference" else "start-") + uuid.uuid4().hex,
                       })
    target = server.folder / "secrets/operations"
    target.mkdir(parents=True, mode=0o700)
    target.parent.chmod(0o700)
    for name in ("spring.rabbitmq.password", "observer.secret"):
        path = source / name
        if not path.is_file() or path.is_symlink() or path.stat().st_mode & 0o777 != 0o600:
            server.cleanup()
            raise ValueError("Prepare private operations infrastructure secrets first")
        shutil.copyfile(path, target / name)
        (target / name).chmod(0o600)
    return server
