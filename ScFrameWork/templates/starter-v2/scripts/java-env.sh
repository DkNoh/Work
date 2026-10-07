#!/usr/bin/env bash
# source해서 사용할 JDK 21을 현재 스크립트 프로세스 안에서만 선택한다.
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
