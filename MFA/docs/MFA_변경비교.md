# 기준 원본과 NEW_MFA 변경 비교

작성일: 2026-10-07.

## 1. 기준 경로와 이번 반영 범위

| 구분 | 기준 경로 | 이번 작업 |
| --- | --- | --- |
| 수정 전 MFA | `/home/dk/mobilecert/MFA인증/` | 읽기 전용 비교 원본 |
| 수정된 SMS 원본 | `/home/dk/Work/omoWorker/` | 읽기 전용, 필요한 추가분만 문서화 |
| 이전 작업 결과 | `/home/dk/Documents/TO-BE_MFA/` | 데몬·JUnit·쉘·UI 적용안의 재사용 후보 |
| 이번 기준 산출물 | `/home/dk/Work/NEW_MFA/` | 독립 데몬 소스/검증 도구 실제 반영, SMS는 docs/md만 |

`NEW_MFA/src`는 **독립 MFA 데몬**이다. SMS 로그인 Java/HTML/JS를 이 src에 섞지 않는다.
`MFA_T`, `MFA_TEST` 폴더는 가져오지 않았다. 최신 SMS UI는 문서의 추가분으로만 정리한다.
제공된 JSP 분석은 완료했으며 [분석 결과](JSP_분석현황.md)에 역할별 대응과 전문 계약을 정리했다.

## 2. 실제 원본과 이전 결과 비교

| 항목 | MFA 기준 원본 | 이전 TO-BE 결과 | NEW_MFA 반영 |
| --- | --- | --- | --- |
| 구동 | WEB-INF/web.xml에서 ServletContextListener 기동 | JDK 21 독립 main/JAR | 반영 |
| DB 연결 | MFADBManager의 DriverManager 직접 연결 | HikariDataSource | 반영 |
| DB 자원 | 수동 close/메서드별 commit | try-with-resources, 풀 반환 | 반영 |
| 인증정보·SMS 저장 | 각각 commit, 실패 시 보상 삭제 | 두 INSERT를 같은 트랜잭션으로 처리 | 반영 |
| 전문 처리 | 기본 문자셋, Java 문자열 106자, LF/EOF 대기 | 명시적 EUC-KR 기본값, 106바이트 | 반영, 실제 호출자 호환 검증 필요 |
| 인증번호 생성 | 시간 기반 Random 사용 경로 | SecureRandom 6자리 | 반영 |
| 검증 성공 판단 | UPDATE 결과와 별개로 성공 코드 설정 경로 | 미사용/만료 조건 UPDATE 1건일 때 성공 | 반영, 실제 설정 SQL에도 조건 필요 |
| 민감 로그 | 요청·응답 전문 로깅 | 원문/OTP 로깅 배제 | 반영 |
| TCP 자원 | WAS에 종속된 worker 운용 | 읽기 timeout, bounded queue, 종료 처리 | 반영 |
| JUnit | MFA 경로의 테스트/빌드 정의 미확인 | 기본 테스트 57건 | 분석 쉘 계약 3건, JSP 방식 발급→검증 소켓 흐름 1건 추가 |
| 커버리지 | MFA JaCoCo 설정 없음 | 이전 MFA pom에도 JaCoCo 없음 | JaCoCo XML/HTML 생성 추가 |
| 실행/HealthCheck | 해당 MFA 전용 쉘 미확인 | local/dev 관리·probe 쉘 | 반영 |
| Sonar 분석 | MFA 분석 설정/결과 없음 | JDK 검사와 SonarLint 안내만 존재 | Maven Sonar 프로필·실행 쉘 추가; 서버 분석은 별도 |

근거: `MFADBManager.getConnection()`, `TcpIpServletContextListener`, `TcpIpProc.call()`, `MFADao`의 insert/update 메서드와 이전 TO-BE의 실제 클래스 비교.
원본에 getConnection2()가 있지만 확인한 MFA 요청 처리 경로는 getConnection()을 호출한다.
SMS 프로젝트 자체의 DB 풀을 바꾸는 작업은 이번 범위가 아니다.

## 3. 원본 파일 → 신규 책임 매핑

아래 원본 이름은 `WEB-INF/src/com/scbk/mfa/` 아래 상대 경로다.

| 원본 | NEW_MFA의 파일 | 변경 내용 |
| --- | --- | --- |
| daemon/TcpIpServletContextListener.java | src/main/java/com/scbk/mfa/MfaDaemonMain.java | 설정 로드·풀 조립·TCP 실행·정상 종료를 main에서 관리 |
| daemon/TcpIpDaemon.java | server/MfaTcpServer.java | listen/bind/worker/queue/lifecycle |
| daemon/TcpIpProc.java | server/MfaConnectionHandler.java | 연결당 한 요청 읽기·응답·소켓 정리 |
| daemon/TcpIpProc.java, common/MFADataConstant.java | protocol/MfaCodec.java, MfaMessage.java, MfaResponse.java, MfaFrameReader.java | 바이트 전문 encode/decode와 경계 검증 |
| daemon/TcpIpProc.java, common/MFAUtils.java | service/MfaService.java | ID 검증·발급·만료·검증·일회성 소비 |
| dao/MFADao.java | service/MfaRepository.java, persistence/JdbcMfaRepository.java | 업무 계약과 JDBC 분리, 트랜잭션 |
| common/MFADBManager.java | persistence/MfaDataSourceFactory.java | HikariCP 생성/종료 |
| common/MFAConfig.java | config/MfaConfig.java, conf/*.example | 설정/SQL 외부화, 비밀값 미포함 |
| 기존 웹 배포 구성 | pom.xml, bin/, deploy/mfa-daemon.service | 독립 JAR과 선택적 systemd 예시 |

표에서 축약한 신규 Java 경로는 `src/main/java/com/scbk/mfa/` 기준이다.
기존 웹 서비스의 다른 패키지는 통째로 복사하지 않는다. 실행 계약·실제 운영 사용처 검토 없이 원본을 삭제하지 않는다.

## 4. DB SQL 바인딩 계약

실제 운영 DDL/SQL은 확정하지 않았다. 예제 query.*는 DBA/개발자가 실제 컬럼·타입과 대조해야 한다.
H2 테스트는 JDBC/트랜잭션/풀 검증이며 Oracle SQL 호환성 인증이 아니다.

| 설정 키 | 파라미터 순서/결과 |
| --- | --- |
| query.select-phone | 1: 행번, 첫 번째 결과 컬럼: 전화번호 |
| query.select-sequence | 파라미터 없음, 첫 번째 결과 컬럼: SMS 시퀀스 |
| query.insert-auth-code | 1~8: 인증 시퀀스, 인증번호, 행번, 전화번호, 채널, 요청일, 요청시각, 만료일시 |
| query.insert-sms | 1~7: SMS 메시지 ID, 현재 일시, 전화번호, 현재 일시, 요청일, 메시지, 사원 ID |
| query.select-auth-code | 1~2: 인증 시퀀스, 인증번호 / EXPIRE_DTTM 결과 컬럼, 미사용 조건 |
| query.consume-auth-code | 1~6: 응답일, 응답시각, 응답일시, 인증 시퀀스, 인증번호, 만료 비교 시각 |

consume SQL에는 미사용 조건과 만료 조건이 필요하다. Java에서 UPDATE 행 수가 1인지 확인한다.
MFA/SMS INSERT는 같은 connection에서 실행되며 하나라도 실패하면 둘 다 rollback한다.
인증정보/DB 비밀번호를 테스트 로그에 출력하지 않는다. H2는 test scope이므로 운영 JAR에 포함하지 않는다.

## 5. 호환성 확인이 필요한 변경

1. 원본의 106 **문자**와 신규 106 **바이트**는 한글 포함 시 다를 수 있다. 제공된 JSP의 기본 JVM 문자셋·EUC-KR 패딩·송신 EOF/readLine 흐름은 분석했다. SMS 문서 클라이언트에 EOF 송신을 반영했으며 실제 운영 문자셋 대조는 남아 있다.
2. A→B, C→D, E 유형과 응답 코드 의미는 유지하지만 일부 응답 문구 및 검증 성공 보조 필드는 다르다. byte-for-byte 완전 동일이라고 보증하지 않는다.
3. SMS 사원 ID를 `inData.substring(25,31)`로 가져오던 기존 동작은 이전 변환 코드에 호환 목적으로 남아 있다. 실제 업무 필드 매핑을 확인하기 전 임의 변경하지 않았다.
4. 채널+초 단위 인증 시퀀스는 기존과 같은 초에 충돌할 가능성이 남아 있다. 이번 경로 정리 과정에서 관련 없는 채번 정책을 새로 바꾸지 않았다.
5. 발급 성공은 SMS 큐 등록 성공이지 휴대전화 도착 보장이 아니다.
6. Z/E400 HealthCheck는 **신규 데몬 전용**이다. 원본 TcpIpProc는 유형 판정 전 DB 연결을 얻으므로 원본 서버에 무DB probe로 적용하지 않는다.
7. 실제 Oracle, LDAP, 방화벽, SMS 발송 통합은 별도 검증이 필요하다.

## 6. SMS에 반영할 방향

기존 로그인 이벤트에서 LDAP 성공이 확정된 뒤 MFA를 진행하고, 성공한 경우에만 기존 `loginForm.submit()`을 호출한다.
서버는 LDAP 성공 ID와 MFA 완료를 세션으로 확인하고 최종 POST /login 전 우회를 차단한다.
`emp.mfa_yn` 분기는 넣지 않는다. 전화번호 조회는 독립 MFA 데몬이 담당한다.

지정 SMS 원본에서 확인한 login.html은 direct POST /login이다. dev/prod LDAP Provider도 있으나,
사용자 설명의 폐쇄망 AD AJAX 코드가 이 사본에 없으므로 존재하지 않는 메서드명을 확정해 덮어쓰지 않는다.
[추가·수정 부분만 모은 문서](SMS_MFA_추가수정.md)를 실제 수정된 로그인 성공 분기에 적용한다.
`login_mfa.jsp`의 A/B200, C/D200 검사와 SMSADMIN 채널·송신 EOF를 문서 코드에 반영했다.
JSP의 화면 타이머 180초와 데몬 만료 5분의 차이를 확인했으며 새 UI는 서버 기준 300초를 사용한다.
JSP 소스 분석 완료와 실제 폐쇄망 SMS 로그인 연동 완료는 구분한다.

## 7. 이전 폴더의 취급

| 이전 위치 | 이번 취급 |
| --- | --- |
| TO-BE_MFA/src, bin, tools | 검증 후보로 재사용하고 NEW_MFA에서 다시 검증 |
| TO-BE_MFA/MFA_T | 기존 MFA_PENDING/SecurityContext 승격 방식. 최신 이벤트 사이 삽입 방식과 달라 복사 제외 |
| TO-BE_MFA/MFA_TEST | 수동 발급/검증 도구. 로그인 통합이 아니므로 제외 |
| TO-BE_MFA/docs/login-ui | Axios UI의 코드 부분을 MD에만 반영. 모의 adapter·독립 미리보기 HTML은 제외 |
| TO-BE_MFA/docs/STATIC_ANALYSIS.md | 과거 JDK 검사 기록. Sonar 실행 완료 근거로 사용하지 않음 |

## 8. 다음 적용 순서

1. login_mfa.jsp 원본 흐름 분석 및 MD 소켓 계약 반영 완료.
2. SMS 실제 LDAP 성공 분기와 입력/응답 계약에 맞춰 MD 추가분 병합.
3. NEW_MFA local 테스트 DB SQL/설정 연결 및 별도 포트 기동.
4. JUnit → JDBC/Hikari → TCP/쉘 → 실제 Oracle → SMS 로그인 순서로 검증.
5. 승인된 사내 SonarQube 서버 설정으로 분석/Quality Gate 결과 확인.
6. 병행 검증 후 배포 경로/기존 데몬 종료·복구 절차 확정.
