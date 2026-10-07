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
# dev에서는 외부 DB URL·계정·secret/JAR/log 경로를 상속하지 않고 새 개발 경로를 사용한다.
export SC_DB_BASE="$SC_HOME/data/sc-reference"
export SC_DB_URL="jdbc:h2:file:$SC_DB_BASE;DB_CLOSE_ON_EXIT=FALSE"
export SC_DB_USERNAME=sa
export SC_DB_PASSWORD=''
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
[[ -f "$ROOT/backend/reference-app/target/sc-reference-app.jar" ]] || "$ROOT/scripts/build.sh"
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
