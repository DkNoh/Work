#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
if [[ "${BASH_SOURCE[0]}" != "$TASK_ROOT/scripts/run.sh" ]]; then exec bash "$TASK_ROOT/scripts/run.sh" "$@"; fi
cd "$TASK_ROOT"
source "$TASK_ROOT/scripts/java-env.sh"
SC_HOME="${SC_HOME:-$TASK_ROOT/.runtime/local}"
[[ "$SC_HOME" = /* ]] || { echo 'SC_HOME은 절대 경로여야 합니다.' >&2; exit 1; }
SC_PROFILE="${SC_PROFILE:-prod}"
case "$SC_PROFILE" in dev|prod|audit|dev,audit|prod,audit|file-storage|dev,file-storage|prod,file-storage|audit,file-storage|dev,audit,file-storage|prod,audit,file-storage) ;; *) echo '지원하지 않는 profile입니다.' >&2; exit 1;; esac
SC_BOOTSTRAP_SECRET_FILE="${SC_BOOTSTRAP_SECRET_FILE:-$SC_HOME/secrets/bootstrap.secret}"
node "$TASK_ROOT/scripts/create-secret.mjs" "$SC_BOOTSTRAP_SECRET_FILE"
mkdir -p "$SC_HOME/data" "$SC_HOME/logs" "$SC_HOME/uploads"
export SC_HOME SC_PROFILE SC_BOOTSTRAP_SECRET_FILE
export SC_BOOTSTRAP_USERNAME="${SC_BOOTSTRAP_USERNAME:-admin}"
export SC_PORT="${SC_PORT:-__SERVER_PORT__}" SC_ADDRESS="${SC_ADDRESS:-127.0.0.1}"
export SC_DB_URL="${SC_DB_URL:-jdbc:h2:file:$SC_HOME/data/app;DB_CLOSE_ON_EXIT=FALSE}"
export SC_LOG_FILE="${SC_LOG_FILE:-$SC_HOME/logs/app.log}" SC_UPLOAD_ROOT="${SC_UPLOAD_ROOT:-$SC_HOME/uploads}"
SC_APP_JAR="${SC_APP_JAR:-$TASK_ROOT/backend/target/__APP_NAME__.jar}"
[[ -f "$SC_APP_JAR" ]] || { echo 'scripts/build.sh로 JAR를 먼저 생성하세요.' >&2; exit 1; }
PID_FILE="$SC_HOME/app.pid"
( set -o noclobber; printf '%s\n' "$$" > "$PID_FILE" ) 2>/dev/null || { echo 'PID 파일이 존재합니다. scripts/stop.sh로 상태를 확인하세요.' >&2; exit 1; }
TASK_CHILD=''
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$TASK_CHILD" ]] && kill -0 "$TASK_CHILD" 2>/dev/null; then kill -TERM "$TASK_CHILD" 2>/dev/null || true; wait "$TASK_CHILD" || true; fi
  rm -f "$PID_FILE"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$JAVA_BIN" -jar "$SC_APP_JAR" "--spring.profiles.active=$SC_PROFILE" &
TASK_CHILD="$!"
wait "$TASK_CHILD"
