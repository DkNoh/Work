#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
SC_HOME="${SC_HOME:-$TASK_ROOT/.runtime/local}"
PID_FILE="$SC_HOME/app.pid"
[[ -f "$PID_FILE" && ! -L "$PID_FILE" ]] || { echo '현재 앱의 PID 파일이 없습니다.'; exit 0; }
TASK_PID="$(cat "$PID_FILE")"
[[ "$TASK_PID" =~ ^[1-9][0-9]*$ ]] || { echo 'PID 파일을 확인하세요.' >&2; exit 1; }
TASK_COMMAND="$(ps -p "$TASK_PID" -o command= || true)"
if [[ -z "$TASK_COMMAND" ]]; then rm -f "$PID_FILE"; echo '중지된 앱 PID 파일을 정리했습니다.'; exit 0; fi
[[ "$TASK_COMMAND" == *"$TASK_ROOT/scripts/run.sh"* ]] || { echo '현재 앱 실행 스크립트의 PID가 아닙니다. 임의 프로세스는 종료하지 않습니다.' >&2; exit 1; }
kill -TERM "$TASK_PID"
for TASK_ATTEMPT in {1..100}; do kill -0 "$TASK_PID" 2>/dev/null || { echo '앱 중지 완료'; exit 0; }; sleep 0.1; done
echo '정상 종료가 지연되고 있습니다. 강제 종료는 수행하지 않았습니다.' >&2
exit 1
