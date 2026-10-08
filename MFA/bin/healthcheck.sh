#!/usr/bin/env bash
# 읽기 전용 TCP 상태 확인. 인증번호 발급(A)/검증(C)은 보내지 않는다.
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# != 1 || ! "$1" =~ ^(local|dev)$ ]]; then
  echo '사용법: healthcheck.sh local|dev' >&2
  exit 64
fi
MFA_ENV="$1"
CONFIG_PATH="${MFA_CONFIG:-$ROOT_DIR/conf/mfa-$MFA_ENV.properties}"
JAVA_BIN="${MFA_JAVA:-${JAVA_HOME:+$JAVA_HOME/bin/}java}"
exec "$JAVA_BIN" "$ROOT_DIR/tools/MfaHealthCheck.java" "$CONFIG_PATH"
