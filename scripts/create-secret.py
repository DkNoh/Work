#!/usr/bin/env python3
"""새 프로젝트의 최초 비밀번호 파일만 생성한다. 내용은 출력하거나 기존 값을 교체하지 않는다."""
import os
import pathlib
import secrets
import sys

root = pathlib.Path(__file__).resolve().parents[1]
secret = pathlib.Path(sys.argv[1]) if len(sys.argv) == 2 else root / ".runtime/container/secrets/bootstrap.secret"
if len(sys.argv) > 2 or not secret.is_absolute():
    raise SystemExit("사용: python3 scripts/create-secret.py [새 앱의 절대 비밀번호 파일 경로]")
secret.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
if not secret.exists():
    descriptor = os.open(secret, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(secrets.token_urlsafe(24))
secret.chmod(0o600)
print(f"비밀번호 파일 준비: {secret}")
