#!/usr/bin/env bash
# 기존 앱과 다른 포트·개발 자료를 사용하며, 최초 비밀번호 값은 출력하지 않는다.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/clean-env.sh" runtime
source "$ROOT/scripts/java-env.sh"
command -v npm >/dev/null || { echo 'Node.js와 npm이 필요합니다.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3가 필요합니다.' >&2; exit 1; }
export SC_HOME="${SC_HOME:-$ROOT/.runtime/dev}"
[[ "$SC_HOME" = /* ]] || { echo 'SC_HOME에 새 개발 자료의 절대 경로를 지정하세요.' >&2; exit 1; }
export SC_PORT="${SC_PORT:-18082}"
export SC_ADDRESS=127.0.0.1
export SC_APP=reference
export SC_APP_JAR="$ROOT/backend/reference-app/target/sc-reference-app.jar"
# H2는 기존 격리 개발 경로를 유지한다. 외부 DB는 제품명을 명시했을 때만 전달한다.
export SC_DB_VENDOR="${SC_DB_VENDOR:-h2}"
case "$SC_DB_VENDOR" in
  h2) DB_BUILD_PROFILE=db-h2 ;;
  oracle|db2|postgresql) DB_BUILD_PROFILE="db-$SC_DB_VENDOR" ;;
  sqlserver) DB_BUILD_PROFILE=db-mssql ;;
  *) echo 'SC_DB_VENDOR는 h2/oracle/db2/sqlserver/postgresql이어야 합니다.' >&2; exit 1 ;;
esac
export SC_DB_BASE="$SC_HOME/data/sc-reference"
if [[ "$SC_DB_VENDOR" == h2 ]]; then
  export SC_DB_URL="jdbc:h2:file:$SC_DB_BASE;DB_CLOSE_ON_EXIT=FALSE"
  export SC_DB_USERNAME=sa SC_DB_PASSWORD=''
else
  : "${SC_DB_URL:?외부 DB의 SC_DB_URL을 지정하세요.}"
  : "${SC_DB_USERNAME:?외부 DB의 SC_DB_USERNAME을 지정하세요.}"
  : "${SC_DB_PASSWORD?외부 DB의 SC_DB_PASSWORD를 지정하세요.}"
fi
export SC_BOOTSTRAP_USERNAME=admin
export SC_BOOTSTRAP_SECRET_FILE="$SC_HOME/secrets/bootstrap.secret"
export SC_LOG_FILE="$SC_HOME/logs/application.log"
export SC_UPLOAD_DIR="$SC_HOME/uploads"
export SC_ECHO_URL=http://127.0.0.1:9
[[ "${SC_PROFILE:-dev}" == dev || "${SC_PROFILE:-dev}" == dev,operations ]] || {
  echo '개발 SC_PROFILE은 dev 또는 dev,operations만 지정할 수 있습니다.' >&2; exit 1;
}
export SC_PROFILE="${SC_PROFILE:-dev}"
export SC_API_TARGET="http://127.0.0.1:$SC_PORT"
FRONTEND_PORT="${SC_FRONTEND_PORT:-5175}"
[[ -f "$ROOT/backend/reference-app/target/sc-reference-app.jar" ]] || "$ROOT/scripts/build.sh" "-P$DB_BUILD_PROFILE"
[[ -d "$ROOT/node_modules" ]] || (cd "$ROOT" && npm ci --no-audit --no-fund)
python3 "$ROOT/scripts/create-secret.py" "$SC_BOOTSTRAP_SECRET_FILE"
"$ROOT/scripts/run.sh" &
server_pid=$!
frontend_pid=''
cleanup() {
  # npm의 중간 프로세스를 거치지 않아 종료 신호가 실제 Vite 프로세스에 도달한다.
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill -TERM "$frontend_pid"
    wait "$frontend_pid" 2>/dev/null || true
  fi
  if kill -0 "$server_pid" 2>/dev/null; then kill -TERM "$server_pid"; fi
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 - "$SC_PORT" "$server_pid" <<'PY'
import os, sys, time, urllib.request
port, pid = int(sys.argv[1]), int(sys.argv[2])
deadline = time.monotonic() + 60
while time.monotonic() < deadline:
    try:
        os.kill(pid, 0)
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1):
            break
    except ProcessLookupError:
        raise SystemExit("Spring 개발 서버가 종료되었습니다.")
    except OSError:
        time.sleep(0.5)
else:
    raise SystemExit("Spring 개발 서버 준비 시간이 초과되었습니다.")
PY
printf '\nVue: http://127.0.0.1:%s\nSpring: http://127.0.0.1:%s\n최초 비밀번호 파일: %s\n종료: Ctrl+C\n' "$FRONTEND_PORT" "$SC_PORT" "$SC_BOOTSTRAP_SECRET_FILE"
cd "$ROOT/frontend/apps/reference-app"
"$ROOT/node_modules/.bin/vite" --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort &
frontend_pid=$!
wait "$frontend_pid"
