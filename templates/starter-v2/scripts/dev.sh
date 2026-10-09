#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$TASK_ROOT"
[[ -f frontend/src/generated/api.d.ts && -f backend/target/__APP_NAME__.jar ]] || { echo '먼저 npm install 후 bash scripts/build.sh를 실행하세요.' >&2; exit 1; }
export SC_HOME="${SC_HOME:-$TASK_ROOT/.runtime/dev}" SC_PROFILE="${SC_PROFILE:-dev}"
case "$SC_PROFILE" in dev|dev,audit|dev,file-storage|dev,audit,file-storage|dev,operations) ;; *) echo 'dev.sh는 dev 프로필 조합만 지원합니다.' >&2; exit 1;; esac
export SC_API_TARGET="http://127.0.0.1:${SC_PORT:-__SERVER_PORT__}"
TASK_BACKEND='' TASK_FRONTEND=''
cleanup() {
  trap - EXIT INT TERM
  for TASK_PID in "$TASK_FRONTEND" "$TASK_BACKEND"; do [[ -z "$TASK_PID" ]] || kill -TERM "$TASK_PID" 2>/dev/null || true; done
  for TASK_PID in "$TASK_FRONTEND" "$TASK_BACKEND"; do [[ -z "$TASK_PID" ]] || wait "$TASK_PID" || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
bash "$TASK_ROOT/scripts/run.sh" & TASK_BACKEND="$!"
# 직접 node를 기동하여 종료 때 npm 중간 프로세스에 자식이 남지 않게 한다.
node "$TASK_ROOT/node_modules/vite/bin/vite.js" --config "$TASK_ROOT/frontend/vite.config.ts" --host 127.0.0.1 & TASK_FRONTEND="$!"
while kill -0 "$TASK_BACKEND" 2>/dev/null && kill -0 "$TASK_FRONTEND" 2>/dev/null; do sleep 1; done
exit 1
