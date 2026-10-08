#!/usr/bin/env bash
# 동일 설치 경로/환경의 PID만 관리한다. 실제 DB 설정은 외부 properties/환경변수로 주입한다.
set -euo pipefail
umask 077
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# != 2 || ! "$1" =~ ^(local|dev)$ || ! "$2" =~ ^(start|stop|status)$ ]]; then
  echo '사용법: mfa.sh local|dev start|stop|status' >&2
  exit 64
fi
MFA_ENV="$1"
ACTION="$2"
CONFIG_PATH="${MFA_CONFIG:-$ROOT_DIR/conf/mfa-$MFA_ENV.properties}"
JAR_PATH="${MFA_JAR:-$ROOT_DIR/target/mfa-daemon.jar}"
RUN_DIR="${MFA_RUN_DIR:-$ROOT_DIR/run}"
LOG_DIR="${MFA_LOG_DIR:-$ROOT_DIR/logs}"
JAVA_BIN="${MFA_JAVA:-${JAVA_HOME:+$JAVA_HOME/bin/}java}"
START_WAIT="${MFA_START_WAIT_SECONDS:-30}"
STOP_WAIT="${MFA_STOP_WAIT_SECONDS:-30}"
[[ "$START_WAIT" =~ ^[1-9][0-9]*$ && "$STOP_WAIT" =~ ^[1-9][0-9]*$ ]] || exit 64
command -v flock >/dev/null || { echo 'flock 명령이 필요합니다.' >&2; exit 64; }
mkdir -p -- "$RUN_DIR" "$LOG_DIR"
PID_FILE="$RUN_DIR/mfa-$MFA_ENV.pid"
# 동시 start/stop 방지. 자식 JVM에는 잠금 FD를 넘기지 않는다.
exec 9>"$RUN_DIR/mfa-$MFA_ENV.lock"
flock -w 5 9 || { echo '다른 관리 명령이 실행 중입니다.' >&2; exit 1; }

start_ticks() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }

owned_process() {
  [[ -f "$PID_FILE" ]] || return 1
  read -r PROCESS_PID PROCESS_TICKS < "$PID_FILE" || return 1
  [[ "$PROCESS_PID" =~ ^[0-9]+$ && "$PROCESS_TICKS" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$PROCESS_PID" 2>/dev/null || return 1
  [[ "$(start_ticks "$PROCESS_PID")" == "$PROCESS_TICKS" ]] || return 1
  local arg env_match=0 home_match=0
  while IFS= read -r -d '' arg; do
    [[ "$arg" == "-Dmfa.launch.environment=$MFA_ENV" ]] && env_match=1
    [[ "$arg" == "-Dmfa.launch.home=$ROOT_DIR" ]] && home_match=1
  done < "/proc/$PROCESS_PID/cmdline"
  [[ "$env_match" == 1 && "$home_match" == 1 ]]
}

case "$ACTION" in
  status)
    if owned_process; then echo "RUNNING: MFA $MFA_ENV (pid=$PROCESS_PID)";
    else echo "STOPPED: MFA $MFA_ENV"; exit 3; fi
    ;;
  stop)
    if ! owned_process; then echo "STOPPED: MFA $MFA_ENV (관리 대상 프로세스 없음)"; exit 0; fi
    kill -TERM "$PROCESS_PID"
    deadline=$((SECONDS + STOP_WAIT))
    while owned_process; do
      if (( SECONDS >= deadline )); then
        echo '종료 대기시간 초과. PID 파일을 유지합니다. 강제 종료하지 않았습니다.' >&2
        exit 1
      fi
      sleep 0.2
    done
    rm -f -- "$PID_FILE"
    echo "STOPPED: MFA $MFA_ENV"
    ;;
  start)
    if owned_process; then echo "ALREADY RUNNING: MFA $MFA_ENV (pid=$PROCESS_PID)"; exit 0; fi
    [[ -r "$CONFIG_PATH" && -r "$JAR_PATH" ]] || {
      echo '실행 JAR 또는 환경 설정 파일이 없습니다.' >&2; exit 64;
    }
    version="$("$JAVA_BIN" -version 2>&1 | head -n 1)"
    [[ "$version" =~ \"21[.\"] ]] || { echo 'JDK 21이 필요합니다.' >&2; exit 64; }
    # 비밀번호를 JVM 인자에 넣지 않는다. 로그 파일은 umask 077로 생성된다.
    nohup "$JAVA_BIN" "-Dmfa.launch.environment=$MFA_ENV" "-Dmfa.launch.home=$ROOT_DIR" \
      -jar "$JAR_PATH" "$CONFIG_PATH" >>"$LOG_DIR/mfa-$MFA_ENV.log" 2>&1 < /dev/null 9>&- &
    PROCESS_PID=$!
    ticks="$(start_ticks "$PROCESS_PID")" || { echo '기동 실패' >&2; exit 1; }
    printf '%s %s\n' "$PROCESS_PID" "$ticks" > "$PID_FILE"
    deadline=$((SECONDS + START_WAIT))
    while (( SECONDS < deadline )); do
      if ! owned_process; then
        rm -f -- "$PID_FILE"
        echo '기동 실패: 해당 환경의 로그를 확인하세요.' >&2
        exit 1
      fi
      if "$ROOT_DIR/bin/healthcheck.sh" "$MFA_ENV" >/dev/null 2>&1; then
        # 다른 프로세스의 포트 응답을 받아도 새 JVM이 종료됐다면 성공으로 표시하지 않는다.
        sleep 0.2
        if owned_process; then echo "STARTED: MFA $MFA_ENV (pid=$PROCESS_PID)"; exit 0; fi
      fi
      sleep 0.2
    done
    echo '기동 확인시간 초과. 프로세스/PID는 유지되므로 status와 로그를 확인하세요.' >&2
    exit 1
    ;;
esac
