#!/usr/bin/env bash
# JUnit을 관련 범위부터 실행한다. 실제 Oracle/LDAP/SMS에는 접근하지 않는다.
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
[[ $# -le 1 ]] || { echo '사용법: verify.sh [unit|io|shell|all]' >&2; exit 64; }
case "${1:-all}" in
  unit) selection='MfaCodecTest,MfaFrameReaderTest,MfaConfigTest,MfaServiceTest' ;;
  io) selection='JdbcMfaRepositoryTest,MfaTcpServerTest,MfaSocketFlowTest' ;;
  shell) selection='ShellToolsTest,VerificationScriptsTest' ;;
  all) selection='*Test' ;;
  *) echo '사용법: verify.sh [unit|io|shell|all]' >&2; exit 64 ;;
esac
exec mvn -B -ntp "-Dtest=$selection" test
