# 기본 정적 검사와 Sonar 분석

## 실제 추가한 소스/설정

- pom.xml: JaCoCo 0.8.11, test 단계의 XML/HTML 리포트 생성.
- pom.xml의 sonar 프로필: Maven Scanner 5.0.0.4389 고정, Java 21, src/main/java와 src/test/java 범위.
- sonar.coverage.jacoco.xmlReportPaths 및 sonar.junit.reportPaths 연결.
- sonar.scanner.skipJreProvisioning=true: 반입한 Java 런타임을 사용한다.
- bin/static-check.sh: JDK·쉘 기본 정적 검사.
- bin/sonar.sh: 설정 검사, 테스트/보고서 생성, 사내 서버 분석 및 Quality Gate 대기.
- VerificationScriptsTest: 설정 누락 차단, 검사용 모드의 무접속, 토큰을 CLI 인자에 노출하지 않는 계약 검증.

Scanner/JaCoCo는 운영 런타임 라이브러리가 아니다. 이 설정은 원본 MFA와 SMS 프로젝트에는 쓰지 않았다.
Scanner 버전은 고정한 재현 기준이며 사내 SonarQube 서버 버전·허용 버전과의 호환성은 실제 연결 전에 확인한다.

## 실행

```bash
./bin/static-check.sh
./bin/sonar.sh --check-config
./bin/sonar.sh
```

Sonar 실행에는 SONAR_HOST_URL, SONAR_PROJECT_KEY, SONAR_TOKEN이 필요하다.
값은 사용자/사내 비밀 저장소에서 주입하고 파일·명령 인자·로그에 토큰을 쓰지 않는다.
`--check-config`는 값의 존재와 URL 형식만 확인한다. 서버 접속이나 인증 성공을 뜻하지 않는다.
인자 없는 실행은 지정한 서버로 소스 분석 데이터를 전송한다. 예제 공용 서버로 임의 전송하지 않는다.

SonarQube 자체는 JaCoCo 커버리지를 생성하지 않는다. 테스트 단계에서 만든 XML을 Scanner가 가져간다.
공식 근거: [Java coverage](https://docs.sonarsource.com/sonarqube-server/2026.1/analyzing-source-code/test-coverage/java-test-coverage).
토큰 환경변수와 Maven 분석 방식: [SonarScanner for Maven](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner-for-maven).
자동 JRE 다운로드 제어: [JRE provisioning](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/scanner-environment/managing-jre-auto-provisioning).

## SonarLint(SonarQube for IDE)과 구분

SonarLint는 IDE 정적 분석 도구이며 위 Maven Scanner와 같은 실행물이 아니다.
IDE 확장이 설치된 환경에서 NEW_MFA의 Java 소스를 검사할 수 있으나, Maven 테스트만 실행해서 IDE 분석 완료로 기록하지 않는다.
이번 환경에는 해당 확장이 설치되어 있지 않다. 실제 IDE 분석 결과는 미실행으로 남긴다.
MFA_T/MFA_TEST/이전 미리보기 파일을 분석 범위에 섞지 않는다.

## 완료 상태 기록 원칙

- 설정/스크립트 추가와 실제 Sonar 분석 완료를 구분한다.
- 서버 접속·인증·분석·Quality Gate 결과를 확인해야 SonarQube 완료로 기록한다.
- 실제 서버 정보/토큰이 제공되지 않은 현재 단계에서는 서버 분석을 실행하지 않는다.
- JDK 검사 결과와 JUnit 성공을 Sonar 지적 0건으로 표시하지 않는다.
- 실제 결과는 검증 결과 문서에 도구·범위·성공·미실행을 구분해 남긴다.
