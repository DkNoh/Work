#!/usr/bin/env bash
# JDK/쉘 기본 검사. 이 결과를 SonarLint/SonarQube 분석 결과로 표시하지 않는다.
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
[[ $# == 0 ]] || { echo '사용법: static-check.sh' >&2; exit 64; }
mvn -B -ntp -DskipTests compile dependency:build-classpath -Dmdep.outputFile=target/static-classpath.txt
mkdir -p target/basic-checks
jdeps --multi-release 21 --jdk-internals target/classes > target/basic-checks/jdeps.txt 2>&1
jdeprscan --release 21 --class-path "$(cat target/static-classpath.txt)" target/classes > target/basic-checks/jdeprscan.txt 2>&1
for script in bin/*.sh; do bash -n "$script"; done
printf '기본 정적 검사 실행 완료: target/basic-checks/ (Sonar 분석은 별도)\n'
