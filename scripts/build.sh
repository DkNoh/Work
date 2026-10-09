#!/usr/bin/env bash
# 루트 잠금 파일로 프런트를 검증하고, 각 소비 앱의 새 화면을 실행 JAR에 포함한다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/clean-env.sh" tests
source "$ROOT/scripts/java-env.sh"
command -v npm >/dev/null || { echo 'Node.js 24.16과 npm이 필요합니다.' >&2; exit 1; }
cd "$ROOT"
npm ci --no-audit --no-fund
npm run verify
"$ROOT/backend/mvnw" -B -f "$ROOT/backend/pom.xml" clean verify "$@"
for app in reference starter; do
  [[ -f "$ROOT/backend/$app-app/target/sc-$app-app.jar" ]] || {
    echo "실행 JAR가 생성되지 않았습니다: sc-$app-app.jar" >&2
    exit 1
  }
done
echo '통합 빌드 완료: reference-app과 starter-app의 실행 JAR를 생성했습니다.'
