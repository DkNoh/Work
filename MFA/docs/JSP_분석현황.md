# login_mfa.jsp 분석 결과와 SMS 적용 위치

분석일: 2026-10-07. 사용자 제공 원본을 읽고 직접 연결된 전문 패딩/데몬 코드와 대조했다.

- JSP 원본: `/home/dk/mobilecert/MFA인증/WEB-INF/login_mfa.jsp`
- SMS 기준 원본: `/home/dk/Work/omoWorker/`
- 독립 데몬/추가분 문서: `/home/dk/Work/NEW_MFA/`
- **JSP 소스 분석 완료. JSP/WAS 실행 및 실제 폐쇄망 로그인 통합은 미실행.**

원본 JSP와 SMS 소스는 수정하지 않았다. 실제 폐쇄망 SMS에는 추가 수정이 있다는 사용자 설명을 기준으로,
SMS 적용 코드는 [SMS_MFA_추가수정.md](SMS_MFA_추가수정.md)에 파일별 추가·수정 부분만 제공한다.

## 1. JSP에서 확인한 실제 흐름

아래 행 번호는 제공된 원본 JSP 기준이다.

| 단계 | JSP 위치 | 확인한 동작 | SMS 적용 위치 |
| --- | --- | --- | --- |
| 요청 분기 | 23~29, 45, 163 | empId를 받고 mfa_proc=Y이면 검증, 아니면 발급 | 기존 LDAP 성공 뒤 MFA send, 입력 확인 시 verify API |
| 발급 전문 | 165~175 | A, 채널 SMSADMIN, 행번으로 전문 구성 | MfaTcpClient.issue(서버 세션 ID) |
| 발급 송수신 | 181~194 | write/flush/shutdownOutput 후 readLine, B이면서 200인지 검사 | MfaTcpClient.exchange의 EOF 송신 및 유형/코드 검사 |
| 발급 응답 | 210~211, 298 | 시퀀스·OTP 추출, 시퀀스를 hidden으로 전송 | 시퀀스는 서버 세션에 보관; OTP는 브라우저/로그에 반환하지 않음 |
| 검증 화면 | 259~275, 296~308, 355 | 180초 타이머, 6자리 입력, hidden iframe으로 JSP 재요청 | 기존 login.html의 hidden 영역 + 기존 Axios/ApiClient |
| 검증 전문 | 46~58 | C, SMSADMIN, 행번, 시퀀스, 입력 OTP | MfaTcpClient.verify(서버 세션 ID, 서버 시퀀스, 입력 OTP) |
| 검증 결과 | 64~78, 111~120 | D이면서 200일 때만 성공, 아니면 화면 실패 메시지 | VERIFIED일 때만 기존 loginForm.submit() |
| 로그인 완료 | 79~108 | EMP 로그인 기록 갱신, 감사 로그, session.emp, 메인 이동 | 최종 Spring Security 성공 처리와 기존 메인 이동 유지 |

JSP에는 그룹 LDAP 인증 호출이 없다. empPass를 읽는 부분은 있지만 이 파일 안에서 검증하는 사용처는 없다.
따라서 이 JSP만으로 기존 1차 로그인 전체 흐름을 확정할 수 없다. 사용자가 설명한 **실제 LDAP API 성공 분기**를 삽입 지점으로 유지한다.
기존 JSP의 EMP/세션 코드를 MFA API에 그대로 옮기면 최종 Security 로그인보다 먼저 로그인 처리가 완료될 수 있으므로,
로그인 시각·실패 횟수·감사 로그는 실제 SMS의 최종 성공 처리에 있는지 확인한 뒤 누락분만 그 위치에 병합한다.

## 2. A/B/C/D 전문 계약

인증요청번호(시퀀스)와 6자리 인증번호(OTP)는 별도 필드다.

| 필드 | 0부터 시작하는 위치 | 길이 | 내용 |
| --- | --- | ---: | --- |
| 유형 | 0 | 1 | A 발급요청 / B 발급응답 / C 검증요청 / D 검증응답 / E 전문 등 오류 |
| 응답코드 | 1~3 | 3 | 200 성공, 기타 실패 |
| 응답메시지 | 4~43 | 40 | 결과 설명 |
| 채널 | 44~53 | 10 | A/C 모두 SMSADMIN |
| 행번 | 54~59 | 6 | A/C 모두 사용자 ID |
| 인증요청번호 | 60~79 | 20 | B에서 발급받아 C로 전달하는 시퀀스 |
| 인증번호 | 80~85 | 6 | B의 발급 OTP, C의 사용자가 입력한 OTP |
| 예약 필드 | 86~95, 96~105 | 각 10 | 공백 |

JSP 33행의 필드 길이와 NEW_MFA `MfaCodec`의 길이는 `{1,3,40,10,6,20,6,10,10}`으로 같다.
JSP는 Java 문자열 substring으로 응답을 나누고, NEW_MFA는 명시적 문자셋의 **106바이트**를 기준으로 처리한다.
`B200`은 발급/SMS 큐 등록 성공이며, **본인인증 성공은 `D200`**이다. 문자가 실제 수신됐다는 보장은 B200에 포함되지 않는다.

## 3. 이번에 문서 코드에 반영한 차이

### 요청 종료 신호

JSP는 A/C 모두 `write → flush → shutdownOutput` 순서로 송신한다(66~68, 183~185행).
기존 `TcpIpProc.java` 42~48행은 LF 또는 EOF까지 읽는다. 이전 문서의 write 직후 응답 대기 방식은
기존 데몬과 서로 기다려 타임아웃이 날 수 있었다. 문서의 `MfaTcpClient.exchange()`에 아래 두 줄을 추가했다.

```java
socket.getOutputStream().write(frame);
socket.getOutputStream().flush(); // 추가: 송신 완료
socket.shutdownOutput();         // 추가: 기존 데몬에 요청 EOF 전달, 응답 수신은 유지
```

NEW_MFA 데몬은 106바이트 수신 즉시 처리하므로 이 EOF를 요구하지는 않지만 동일하게 수용한다.
응답은 송신 후 소켓을 닫으므로 JSP의 readLine()도 EOF에서 반환할 수 있다.

### 채널과 C 요청 필드

JSP의 채널은 `SMSADMIN`이다. 기존 문서의 기본값 `SMS`를 `SMSADMIN`으로 수정했다.
이 값은 데몬의 DB 저장, SMS 본문, 시퀀스 생성에도 사용된다.

C 요청에도 JSP처럼 채널과 행번을 채우도록 문서 코드를 수정했다.
현재 확인한 양쪽 데몬의 C 처리 자체는 시퀀스와 OTP로 조회하지만, 기존 호출 전문 형태를 유지한다.

```java
// 기존 Controller의 검증 호출 부분만 변경. ID와 시퀀스는 서버 세션에서 읽는다.
boolean verified = client.verify(state.empId, state.sequence, body.code());
```

### 타이머와 로그인 상태

JSP 260행은 180초지만 기존 데몬 `TcpIpProc.java` 120행의 발급 만료는 5분이다.
새 적용안은 이전에 작성한 **서버 기한 기준 300초**를 유지하고 데몬 TTL과 설정을 맞춘다.
검증 5회·발송 3회·재전송 대기 30초는 기존 JSP 정책을 복사한 것이 아니라 이번 적용안의 정책이다.

JSP의 hidden 시퀀스 대신 서버 세션의 시퀀스를 사용한다. 요청 ID도 LDAP가 성공한 서버 상태에서 가져온다.
MFA API의 검증 성공은 대기 상태에만 기록하고, 최종 POST /login 앞의 서버 검사에서 같은 ID의 완료 상태를 1회 사용한다.
기존 JSP의 session.emp 생성이나 notice_list.jsp 이동은 복사하지 않는다. SMS의 기존 Security 인증·성공 URL을 유지한다.

## 4. 문자셋과 응답 호환성의 한계

- JSP 페이지 선언은 EUC-KR이지만 소켓 getBytes()/InputStreamReader에는 문자셋 인수가 없다(66,70,183,187행). 따라서 실제 소켓은 JVM 기본 문자셋이다.
- 직접 호출한 `com/arreo/common/Util.java` 1082~1091행은 EUC-KR 바이트 길이로 패딩한다. 숫자·영문 채널·공백으로 구성된 정상 요청은 이 차이에 영향을 받지 않는다.
- NEW_MFA 및 문서 클라이언트는 EUC-KR을 명시한다. 기존 운영 JVM 문자셋, 한글 오류문구의 실제 수신은 운영 환경 대조가 남아 있다.
- 기존 `TcpIpProc.java` 177행은 D 성공의 채널 칸에 긴 한글 메시지를 넣고 `MFAUtils`는 초과 길이를 자르지 않는다. 기존 응답 전체가 언제나 106바이트라고 보증할 수 없다. NEW_MFA는 그 보조 필드를 비운다. JSP는 D의 유형/코드만으로 성공을 판단하므로 그 판단은 유지된다.
- 제공 파일은 `WEB-INF`에 저장되어 있고 form action은 `/login_mfa.jsp`다. 이는 전달받은 소스 위치이며 실제 WAS의 URL 매핑/배치 위치까지 확인한 것은 아니다.

## 5. 확인 범위와 적용 순서

소스 분석은 완료했다. 독립 데몬 테스트와 문서 클라이언트 검증의 구체적 실행 결과는 [검증결과.md](검증결과.md)에 구분하여 기록한다.
실제 Oracle·SMS 문자 발송·기존 WAS/JSP·그룹 LDAP를 실행한 통합 결과로 해석하지 않는다.

1. 실제 SMS의 기존 LDAP 성공 분기에 [추가 코드](SMS_MFA_추가수정.md)를 병합한다.
2. 동일 문서의 MfaTcpClient, 서버 세션 상태, MFA API, 최종 /login 검사 부분을 적용한다.
3. 기존 login.html 영역/JS만 추가하고 기존 ApiClient와 Security 최종 성공 처리를 유지한다.
4. 실제 환경의 문자셋/SQL/포트와 로그인 기록 처리 위치를 확인하고 발급·오입력·정상·만료·재사용을 통합 검증한다.
