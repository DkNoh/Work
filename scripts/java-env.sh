#!/usr/bin/env bash
# source해서 사용할 JDK 21을 현재 스크립트 프로세스 안에서만 선택한다.
# Git Bash에서 Windows npm/node를 거치면 /c/... 환경변수가 C:/...로 변환된다.
# Windows 경로를 먼저 Bash 경로로 되돌려 dirname·실행 가능 여부·절대 경로 검사가
# 공백이 포함된 JDK 설치 경로에서도 동일하게 동작하도록 한다.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    for sc_java_variable in JAVA21_HOME JAVA_BIN JAVA_HOME; do
      if [[ -n "${!sc_java_variable:-}" ]]; then
        printf -v "$sc_java_variable" '%s' "$(cygpath -u "${!sc_java_variable}")"
      fi
    done
    unset sc_java_variable
    ;;
esac
if [[ -n "${JAVA21_HOME:-}" ]]; then
  export JAVA_HOME="$JAVA21_HOME"
  JAVA_BIN="$JAVA_HOME/bin/java"
elif [[ -n "${JAVA_BIN:-}" ]]; then
  export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
elif [[ -n "${JAVA_HOME:-}" ]]; then
  JAVA_BIN="$JAVA_HOME/bin/java"
elif [[ -x /usr/libexec/java_home ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  JAVA_BIN="$JAVA_HOME/bin/java"
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi
JAVA_BIN="${JAVA_BIN:-$(command -v java || true)}"
[[ "$JAVA_BIN" = /* && -x "$JAVA_BIN" ]] || {
  echo 'JDK 21을 설치하고 JAVA21_HOME 또는 JAVA_BIN을 지정하세요.' >&2
  exit 1
}
"$JAVA_BIN" -version 2>&1 | head -1 | grep -qE 'version "21[.]' || {
  echo '이 프로젝트는 JDK 21을 사용합니다.' >&2
  exit 1
}
export JAVA_BIN
