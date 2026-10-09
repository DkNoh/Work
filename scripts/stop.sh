#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${SC_HOME:-$ROOT/.runtime/local}/run"
[[ -f "$RUN_DIR/app.pid" && -f "$RUN_DIR/app.jar" ]] || {
  echo '이 런처가 만든 실행 PID가 없습니다.' >&2; exit 1;
}
read -r pid < "$RUN_DIR/app.pid"
read -r jar < "$RUN_DIR/app.jar"
[[ "$pid" =~ ^[0-9]+$ ]] || { echo 'PID 메타데이터를 확인하세요.' >&2; exit 1; }
args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
[[ "$args" == *"$jar"* && "$args" == *'-jar'* ]] || {
  echo '기록된 PID와 JAR가 일치하지 않습니다. 프로세스를 직접 확인하세요.' >&2; exit 1;
}
kill -TERM "$pid"
for ((attempt=0;attempt<45;attempt++)); do
  if ! kill -0 "$pid" 2>/dev/null; then echo '정상 종료했습니다.'; exit 0; fi
  sleep 1
done
echo '종료가 지연되고 있습니다. 로그를 확인하세요. 강제 종료하지 않았습니다.' >&2
exit 1
