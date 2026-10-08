# NEW_MFA — 독립 데몬과 SMS 추가분 문서

## 기준 경로

- 수정 전 MFA 원본: `/home/dk/mobilecert/MFA인증/`
- 수정된 SMS 기준 원본: `/home/dk/Work/omoWorker/`
- 이번 작업 결과: `/home/dk/Work/NEW_MFA/`
- 이전 `/home/dk/Documents/TO-BE_MFA/`는 참고 산출물이며 이후 적용 기준을 혼용하지 않는다.

## 이 폴더의 역할

`src/`는 **독립 Java MFA 데몬**이다. HikariCP, JDBC 트랜잭션, JUnit, 실행·검사 쉘을 실제 반영했다.
SMS 로그인은 기존 제품 소스를 많이 수정한 상태를 고려해 **docs의 Markdown 추가분만 제공**한다.
SMS 원본 Java/HTML/JS 전체를 복사하거나 덮어쓰지 않았다. MFA_T/MFA_TEST 폴더도 만들지 않는다.

```text
NEW_MFA/
├── pom.xml                       # Java 21/Hikari/JUnit/H2(test)/JaCoCo/Sonar 프로필
├── src/main/java/com/scbk/mfa/    # 독립 데몬 실제 소스
├── src/test/java/com/scbk/mfa/    # 단위·JDBC·TCP·쉘 테스트
├── bin/
│   ├── mfa.sh                    # local/dev start|stop|status
│   ├── healthcheck.sh            # local/dev 무발송 TCP probe
│   ├── verify.sh                 # JUnit 범위별 실행
│   ├── static-check.sh           # 기본 JDK/쉘 정적 검사
│   └── sonar.sh                  # SonarQube 설정 확인/분석
├── conf/*.properties.example     # 인증정보 없는 환경 템플릿
├── tools/MfaHealthCheck.java
├── deploy/mfa-daemon.service      # 선택적 systemd 배포 예시
├── docs/
│   ├── MFA_변경비교.md
│   ├── SMS_MFA_추가수정.md
│   ├── JSP_분석현황.md
│   ├── 실행_검증.md
│   ├── 정적분석_Sonar.md
│   └── 검증결과.md
└── target/                       # 빌드·테스트 생성물
```

## 먼저 읽을 문서

1. [원본/이전 결과 비교 및 실제 변경 범위](docs/MFA_변경비교.md)
2. [SMS 로그인 추가·수정 부분과 소스코드](docs/SMS_MFA_추가수정.md)
3. [login_mfa.jsp 분석 결과와 소켓 계약](docs/JSP_분석현황.md)
4. [local/dev 실행과 JUnit](docs/실행_검증.md)
5. [Sonar 설정·실행과 미실행 범위](docs/정적분석_Sonar.md)
6. [이번 경로에서의 검증 결과](docs/검증결과.md)

## 남아 있는 입력/검증

- 제공된 WEB-INF/login_mfa.jsp 분석을 완료하고 소켓 EOF·SMSADMIN 채널·C 요청 필드를 SMS 문서에 반영했다.
- SMS 추가분은 JSP 계약을 반영했지만 실제 폐쇄망 수정본에 병합한 뒤 로그인 통합 검증이 필요하다.
- SonarQube 서버·프로젝트·토큰 설정 후 실제 분석이 필요하다. 프로필/쉘 추가만으로 분석 완료가 아니다.
- 운영 Oracle DDL/SQL·실제 LDAP·SMS 발송 연동은 별도 통합 검증 대상이다.
