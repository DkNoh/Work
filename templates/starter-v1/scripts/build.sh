#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$TASK_ROOT"
source "$TASK_ROOT/scripts/java-env.sh"
[[ -f package-lock.json ]] || { echo '최초 생성 뒤 npm install로 독립 package-lock.json을 만들고 검토하세요.' >&2; exit 1; }
npm ci
# 프런트 타입이 참조할 실제 업무 DTO를 먼저 새 임시 H2 서버에서 수집한다.
(cd backend && ./mvnw -B -Dmaven.test.skip=true clean package)
node scripts/bootstrap-api.mjs
npm run verify
(cd backend && ./mvnw -B clean verify)
echo '프런트와 실제 테스트를 포함한 신규 앱 JAR 빌드 완료'
