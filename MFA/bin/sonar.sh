#!/usr/bin/env bash
# Maven Scanner로 사용자가 지정한 SonarQube 서버에 분석한다. 토큰은 환경변수로만 전달한다.
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
if [[ $# -gt 1 || ( $# == 1 && "$1" != '--check-config' ) ]]; then
  echo '사용법: sonar.sh [--check-config]' >&2
  exit 64
fi
for key in SONAR_HOST_URL SONAR_PROJECT_KEY SONAR_TOKEN; do
  if [[ -z "${!key:-}" ]]; then
    printf '필수 환경변수 누락: %s (값은 출력하지 않음)\n' "$key" >&2
    exit 64
  fi
done
if [[ "$SONAR_HOST_URL" != https://* && "$SONAR_HOST_URL" != http://* ]]; then
  echo 'SONAR_HOST_URL은 HTTP(S) 주소여야 합니다.' >&2
  exit 64
fi
if [[ "${1:-}" == '--check-config' ]]; then
  echo '설정 존재 확인 완료. 서버 접속·분석은 실행하지 않았습니다.'
  exit 0
fi
# SONAR_TOKEN은 Scanner가 환경에서 읽는다. -Dsonar.token이나 debug 출력에 싣지 않는다.
exec mvn -B -ntp -Psonar "-Dsonar.projectKey=$SONAR_PROJECT_KEY" \
  -Dsonar.qualitygate.wait=true verify sonar:sonar
