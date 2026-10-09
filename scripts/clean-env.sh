#!/usr/bin/env bash
# source로 호출한다. 외부 Spring 설정/JVM -D 옵션이 새 앱 설정을 덮어쓰지 않게 한다.
ENV_MODE="${1:-runtime}"
[[ "$ENV_MODE" == runtime || "$ENV_MODE" == tests ]] || {
  echo '환경 정리 모드를 확인하세요.' >&2
  exit 1
}
while IFS= read -r variable; do
  case "$variable" in
    APP_*|WORKBOARD_*|SPRING_*|SERVER_*|LOGGING_*|MANAGEMENT_*|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS)
      unset "$variable"
      ;;
    SC_*|MAVEN_OPTS|MAVEN_ARGS)
      if [[ "$ENV_MODE" == tests ]]; then unset "$variable"; fi
      ;;
  esac
done < <(compgen -e)
unset ENV_MODE variable
