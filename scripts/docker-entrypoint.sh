#!/usr/bin/env bash
# 호스트의 600 secret를 이미지에 포함하지 않고 tmpfs에 준비한 뒤 앱 사용자로 전환한다.
set -euo pipefail
umask 077
source /app/clean-env.sh runtime
if [[ -n "${SC_PROFILE:-}" ]]; then
  [[ "$SC_PROFILE" == dev || "$SC_PROFILE" == prod || "$SC_PROFILE" == operations || "$SC_PROFILE" == dev,operations || "$SC_PROFILE" == prod,operations ]] || {
    echo 'SC_PROFILE은 dev/prod 또는 operations와의 명시된 조합만 지정할 수 있습니다.' >&2
    exit 1
  }
  export SPRING_PROFILES_ACTIVE="$SC_PROFILE"
fi
test -f /run/secrets/bootstrap_secret || {
  echo '컨테이너 최초 비밀번호 파일을 마운트하세요.' >&2
  exit 1
}
install -d -m 700 -o 10001 -g 10001 /run/sc-secret
install -m 600 -o 10001 -g 10001 /run/secrets/bootstrap_secret /run/sc-secret/bootstrap.secret
if [[ "${SC_PROFILE:-}" == *operations* ]]; then
  install -d -m 700 -o 10001 -g 10001 /run/sc-operations
  install -m 600 -o 10001 -g 10001 /run/secrets/broker_secret /run/sc-operations/spring.rabbitmq.password
  install -m 600 -o 10001 -g 10001 /run/secrets/observer_secret /run/sc-operations/observer.secret
fi
for folder in /app/data /app/logs /app/uploads "${SC_HOME:-/app/runtime}" "${SC_HOME:-/app/runtime}/data" "${SC_HOME:-/app/runtime}/logs" "${SC_HOME:-/app/runtime}/uploads"; do
  install -d -m 700 -o 10001 -g 10001 "$folder"
done
export SC_BOOTSTRAP_SECRET_FILE=/run/sc-secret/bootstrap.secret
exec gosu 10001:10001 java -Xms"${SC_XMS:-128m}" -Xmx"${SC_XMX:-384m}" -jar /app/application.jar
