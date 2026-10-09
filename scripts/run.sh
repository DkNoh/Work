#!/usr/bin/env bash
# 같은 앱의 중복 기동을 막고, 정상 종료할 때 Java 자식과 실행 메타데이터를 함께 정리한다.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/clean-env.sh" runtime
source "$ROOT/scripts/java-env.sh"
SC_HOME="${SC_HOME:-$ROOT/.runtime/local}"
SC_APP="${SC_APP:-reference}"
[[ "$SC_APP" == reference || "$SC_APP" == starter ]] || {
  echo 'SC_APP은 reference 또는 starter여야 합니다.' >&2; exit 1;
}
SC_APP_JAR="${SC_APP_JAR:-$ROOT/backend/$SC_APP-app/target/sc-$SC_APP-app.jar}"
[[ "$SC_HOME" = /* && "$SC_APP_JAR" = /* && -f "$SC_APP_JAR" ]] || {
  echo 'SC_HOME과 존재하는 SC_APP_JAR의 절대 경로를 지정하세요.' >&2; exit 1;
}
# 프로필은 이 앱의 명시적 설정만 받는다. 빈 기본값에서는 Swagger가 비활성이다.
if [[ -n "${SC_PROFILE:-}" ]]; then
  case "$SC_PROFILE" in
    dev|prod|operations|dev,operations|prod,operations) ;;
    audit|dev,audit|prod,audit)
      [[ "$SC_APP" == starter ]] || {
        echo 'audit 프로필은 Starter 앱에서만 지정할 수 있습니다.' >&2; exit 1;
      }
      ;;
    file-storage|dev,file-storage|prod,file-storage|audit,file-storage|dev,audit,file-storage|prod,audit,file-storage)
      [[ "$SC_APP" == starter ]] || {
        echo 'file-storage 프로필은 Starter 앱에서만 지정할 수 있습니다.' >&2; exit 1;
      }
      ;;
    *) echo 'SC_PROFILE은 dev/prod, operations 또는 Starter의 audit/file-storage와 명시된 조합만 지정할 수 있습니다.' >&2; exit 1 ;;
  esac
  export SPRING_PROFILES_ACTIVE="$SC_PROFILE"
fi
export SC_DB_BASE="${SC_DB_BASE:-$SC_HOME/data/sc-$SC_APP}"
export SC_HOME
export SC_DB_VENDOR="${SC_DB_VENDOR:-h2}"
case "$SC_DB_VENDOR" in
  h2) export SC_DB_URL="${SC_DB_URL:-jdbc:h2:file:$SC_DB_BASE;DB_CLOSE_ON_EXIT=FALSE}" ;;
  oracle|db2|sqlserver|postgresql) : "${SC_DB_URL:?외부 DB의 SC_DB_URL을 지정하세요.}" ;;
  *) echo '지원하지 않는 SC_DB_VENDOR입니다.' >&2; exit 1 ;;
esac
export SC_PORT="${SC_PORT:-18082}"
export SC_ADDRESS="${SC_ADDRESS:-127.0.0.1}"
export SC_LOG_FILE="${SC_LOG_FILE:-$SC_HOME/logs/application.log}"
export SC_UPLOAD_DIR="${SC_UPLOAD_DIR:-$SC_HOME/uploads}"
export SC_BOOTSTRAP_USERNAME="${SC_BOOTSTRAP_USERNAME:-admin}"
export SC_BOOTSTRAP_SECRET_FILE="${SC_BOOTSTRAP_SECRET_FILE:-$SC_HOME/secrets/bootstrap.secret}"
[[ -f "$SC_BOOTSTRAP_SECRET_FILE" ]] || {
  echo 'SC_BOOTSTRAP_SECRET_FILE에 새 앱의 비밀번호 파일을 지정하세요. 개발 최초 실행은 scripts/dev.sh를 사용하세요.' >&2
  exit 1
}
RUN_DIR="$SC_HOME/run"
mkdir -p "$RUN_DIR" "$(dirname "$SC_DB_BASE")" "$(dirname "$SC_LOG_FILE")"
mkdir "$RUN_DIR/app.lock" 2>/dev/null || {
  echo '실행 잠금이 있습니다. 기존 앱이 정상 종료되었는지 확인하세요.' >&2; exit 1;
}
child=''
cleanup() {
  rm -f "$RUN_DIR/app.pid" "$RUN_DIR/app.jar"
  rmdir "$RUN_DIR/app.lock" 2>/dev/null || true
}
forward() {
  if [[ -n "$child" ]] && kill -0 "$child" 2>/dev/null; then
    kill -TERM "$child"
    wait "$child" || true
  fi
}
trap cleanup EXIT
trap 'forward; exit 130' INT
trap 'forward; exit 143' TERM
"$JAVA_BIN" -Xms"${SC_XMS:-128m}" -Xmx"${SC_XMX:-512m}" -jar "$SC_APP_JAR" &
child=$!
printf '%s\n' "$child" > "$RUN_DIR/app.pid"
printf '%s\n' "$SC_APP_JAR" > "$RUN_DIR/app.jar"
wait "$child"
