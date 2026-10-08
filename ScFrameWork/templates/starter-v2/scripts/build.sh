#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$TASK_ROOT"
source "$TASK_ROOT/scripts/java-env.sh"
[[ -f package-lock.json ]] || { echo '최초 생성 뒤 npm install로 독립 package-lock.json을 만들고 검토하세요.' >&2; exit 1; }
npm ci
# SC_API_SCHEMA/SC_API_URL이 있으면 고객 DB 기동 없이 명세를 수집한다.
# 예: SC_API_SCHEMA=/private/openapi.json SC_DB_VENDOR=oracle bash scripts/build.sh -Pdb-oracle
(cd backend && ./mvnw -B -Dmaven.test.skip=true clean package "$@")
node scripts/bootstrap-api.mjs
npm run verify
(cd backend && ./mvnw -B clean verify "$@")
echo '프런트와 실제 테스트를 포함한 신규 앱 JAR 빌드 완료'
