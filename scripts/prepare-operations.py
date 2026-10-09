#!/usr/bin/env python3
"""새 로컬 운영 환경의 private secret만 생성한다. 값·기존 자료를 출력/덮어쓰지 않는다."""
import argparse
import os
import pathlib
import secrets


def private_file(path, text):
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(text)


def prepare(home):
    home = pathlib.Path(home).absolute()
    if any(parent.is_symlink() for parent in (home, *home.parents)):
        raise ValueError("Symlink runtime roots are forbidden; use the canonical path")
    if home.exists() and any(home.iterdir()):
        raise ValueError("Use a new empty operations runtime root")
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    home.chmod(0o700)
    for name in ("secrets", "secrets/operations", "data", "uploads", "logs"):
        folder = home / name
        folder.mkdir(mode=0o700)
    shared = home / "secrets/operations"
    broker = secrets.token_urlsafe(24)
    private_file(home / "secrets/bootstrap.secret", secrets.token_urlsafe(24))
    private_file(shared / "spring.rabbitmq.password", broker)
    private_file(shared / "observer.secret", secrets.token_urlsafe(24))
    private_file(shared / "grafana.secret", secrets.token_urlsafe(24))
    # RabbitMQ 공식 image는 DEFAULT_PASS_FILE을 지원하지 않는다. private conf를 마운트한다.
    private_file(shared / "rabbitmq.conf", "default_user = sc-framework\ndefault_pass = " + broker
                 + "\nlisteners.tcp.default = 5672\nmanagement.tcp.port = 15672\n"
                 + "vm_memory_high_watermark.absolute = 256MiB\n"
                 + "disk_free_limit.absolute = 128MiB\n")
    return home


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", required=True, type=pathlib.Path)
    args = parser.parse_args()
    try:
        home = prepare(args.home)
    except (OSError, ValueError):
        print("FAIL: use a new empty canonical runtime root with writable private folders.")
        return 1
    print("Prepared private operations runtime: " + str(home))
    print("Secret values were not printed. Existing runtimes were not modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
