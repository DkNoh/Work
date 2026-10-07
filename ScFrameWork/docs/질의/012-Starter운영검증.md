# 012 독립 Starter 운영 검증

상태: 외부 소비 앱의 실제 API 다섯 그룹과 최종 운영 브라우저 여덟 그룹이 각각 통과했다. 최종 브라우저 전용 실행은 whole DOM axe 15회·위반0·중복 ID0이며, 초기 API 실행과 분리하여 기록한다. 012 전체·원격 CI·수동 보조기기 완료를 이 결과로 추론하지 않는다.

## 대상과 private 경계

대상은 `/private/tmp/sc-framework-consumer-012-20261007`의 독립 templateVersion2 앱이다. framework/cohort는 0.3.0, 앱 자체 버전은 1.0.0이다. 자신의 npm 잠금 파일·Notes V1/audit V2/messages V3/Quartz/browser V4와 public npm tarball/Maven dependency를 소비한다. 검증기는 원래 앱의 실행 자료를 읽지 않고 완성된 JAR를 새 private fixture에 bytecopy하여 SHA를 기록한다. 검증 중 원래 JAR가 다시 빌드되어도 이 실행의 bytecopy는 바뀌지 않는다.

`_operations_harness.operations_server`가 새 H2·합성 계정·mode600 파일과 fixture마다 고유 broker namespace를 생성한다. 인프라 연결에만 Root가 준비한 자신의 private broker/observer 파일 두 개를 지정 helper로 복사한다. WorkboardVue/workboard의 runtime·DB·업로드·비밀번호는 사용하지 않는다. 자신의 임시 H2·로그·JAR copy는 finally에서 정리한다. 공유 task 인프라 자체를 전역 삭제하지 않으며 task Compose 프로젝트 정리는 Root/CI owner의 책임이다.

## 실제 실행 명령

```bash
JAVA21_HOME=/absolute/jdk21/home \
python3 -B scripts/verify-generated-operations.py \
  --consumer /private/tmp/sc-framework-consumer-012-20261007 \
  --shared-home /absolute/private/operations-home \
  --output docs/검증/012-generated-operations-new-label
```

PATH에는 검증용 Node 24.16.0이 있어야 한다. 이미 존재하는 output은 거절하여 초기 실패 근거를 덮어쓰지 않는다. `--no-browser`는 API 진단 옵션이며 전체 `passed:true`를 만들지 않는다. `--browser-only`는 승인된 UI 수정의 마지막 검사이며 summary에 별도 scope를 표시하고 이전 API 검증을 반복 실행한 것처럼 기록하지 않는다. 브라우저 helper는 실제 소비 앱 cwd에서 실행하지만 output은 verifier가 절대 경로로 고정한다. verifier 자체는 npm install/Maven 재빌드를 수행하지 않는다.

| 검사              | actual 경계                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| prod 선택 profile | session401·CSRF403·인증 후 비dev Swagger403, Starter 기본 identity username/roles, 4capabilities ON, Reference class0                 |
| Notes 저장        | 실제 JPA insert/Querydsl literal 검색/같은 DataSource MyBatis 집계·revision1→2·409 이후 서버 값 보존                                  |
| 실제 작업·메시지  | registered4, 최초 기본 예약3, PULSE 하나만 생성, API seconds0 다음 분 실행·SUCCESS, MESSAGE_DEMO 실제 COMPLETED 한 행                 |
| 오류 HTTP         | appVersion1.0.0만 허용, notes/patterns 허용·start 거절, session/CSRF/unknown raw canary 거절, 같은 receipt 중복 count1                |
| 같은 H2 재시작    | prod→dev 운영 전환, Notes revision/기본 예약/paused PULSE revision·실행 이력·receipt 집계 보존, 실제 운영13path/OpenAPI integer enum1 |
| 설치된 UI         | 실제 @sc/ui/runtime0.3.0 metadata, JAR Notes 로그인/저장/409·locale draft 유지, 운영 3페이지의390/1366·KO/EN                          |
| whole DOM 접근성  | WCAG2A/AA/2.1A/AA/2.2AA+best-practice, 숨겨지지 않은 전체 문서의 axe·duplicate ID·overflow, 실패 규칙을 끄지 않음                     |
| 실제 collector    | 실제 window throw와 unhandled rejection, 서버 occurrence 증가, 정확히 7필드·appVersion1.0.0·routeCode notes·원문/stack/URL 없음       |
| 정지 상태 DB/로그 | Notes row·PULSE SUCCESS와 효과 수·완료 outbox·raw 오류 컬럼0, private 계정·broker/observer·raw canary 로그 노출0                      |

브라우저는 trace를 켜지 않고 계정 입력을 포함한 네트워크/console 본문을 저장하지 않는다. 의도한 두 runtime 오류만 count로 구분하며 다른 오류는 실패한다. 앱에 debug global을 추가하지 않는다. axe JSON에는 위반 코드·CSS 대상·불완전 검사 수만 쓰고 raw 오류를 저장하지 않는다. PNG에는 로그인 blank 화면과 인증 이후 업무 화면만 저장한다. 자동 axe 성공을 VoiceOver/키보드 수동 점검 완료로 표시하지 않는다.

storage-demo는 현재 프로세스 whitelist만 유지하는 소비 예제다. 기존 Root의 별도 실제 파일 프로필 검사와 구분하며, 이 verifier의 Notes/Quartz/H2 재시작으로 파일 metadata의 crash durability를 주장하지 않는다. MQ confirm/ACK child-JVM 복구와 시스템 백업 복원은 별도 runtime recovery CLI 근거를 따른다.

## 초기 결과

첫 실행은 [summary](../검증/012-generated-operations-first/summary.json)에 보존한다. 실제 API 다섯 그룹(prod/Notes/등록+메시지+PULSE/오류/동일H2 재시작+Swagger)은 통과했다. 브라우저 호출의 relative output을 소비 앱 cwd가 해석하여 ENOENT로 중단된 검증기 오류가 발생했다. 제품 성공/실패나 접근성 통과로 바꾸어 기록하지 않는다.

절대 output으로 고친 [두 번째 결과](../검증/012-generated-operations-second/summary.json)는 API 다섯 그룹과 Notes·실 collector 세 브라우저 그룹·앞선 axe 다섯 회를 통과했다. 오류 이력 버튼의 접근성 이름에 visible `발생 이력` 전체가 없어 다음 화면 대기가 실패했다. 같은 제품 위반은 Root의 내부 앱 whole DOM axe가 이미 확인했으므로 세 번째 반복은 Root 요청에 따라 중단하고 임시 자료를 정리했다. 위반 rule을 끄거나 기대 이름을 낮추는 방식으로 제품 문제를 숨기지 않았다.

Root 승인으로 BrowserPanel의 visible-history 접두사를 v2와 기존 소비 앱에 반영했다. 최초 생성의 sc-starter.lock/provenance는 수정하지 않았다. [수정 기록](../검증/012-generated-consumer-browser-label-repair.json)은 파일별 이전/새 SHA·초기 기록의 template SHA·변경된 JAR SHA를 기록하며 새 생성이라고 주장하지 않는다. 해당 수정 후 npm verify와 frontend-only clean Maven package는 종료0이다. 이 package는 tests skipped이며, Root의 최초 cold consumer JUnit 10개 결과를 재실행한 것으로 표시하지 않는다.

[첫 브라우저 전용 final](../검증/012-generated-operations-final/summary.json)은 여덟 그룹·axe 15회 위반0을 통과했다. 이후 실제 mobile PNG 검토에서 긴 UUID가 옆 칸을 덮는 시각 결함을 확인하여, Root가 승인한 소비 앱 전용 OperationsTable의 `table-layout:auto` 한 줄만 추가했다. framework 0.3.0 public package와 Java/API는 변경하지 않았다. 기존 소비 앱의 독립 Maven 캐시를 재사용하여 npm verify·clean package를 다시 종료0으로 확인했다.

[최종 시각 수정 결과](../검증/012-generated-operations-visual-final/summary.json)와 [실행 로그](../검증/012-generated-operations-visual-final.log)는 브라우저 전용 여덟 그룹, KO/EN·390/1366 운영 세 화면과 Notes 로그인/409/locale 입력 보존, whole DOM axe 15회, PNG 15개를 확인한다. 위반0·중복 ID0·예상외 오류0·실패 asset0이며 incomplete는 총29개로 수동 완료가 아니다. 실제 window throw/rejection 두 건은 appVersion1.0.0/notes/정확히7필드·원문0으로 서버 count 증가까지 통과했다. 메시지 UUID가 자기 cell을 넘지 않는 geometry 검사와 [mobile PNG](../검증/012-generated-operations-visual-final/browser/messages-390-en.png) 직접 확인에서 옆 칸을 덮는 결함이 해소됐다. JAR의 static 10파일은 새 dist와 이름·bytes가 정확히 일치하며 임시 runtime 삭제와 private 값 로그 노출0도 확인했다.

정지 상태 DB scalar 검사는 full verifier 코드에 있지만 초기 전체 실행이 브라우저 단계에서 멈추었고 마지막에는 브라우저만 실행했으므로 이 CLI에서 실행한 것으로 표시하지 않는다. PULSE 효과의 SQL 검사는 Root의 최초 소비 앱 JUnit 10개와 별도 012 서버 검사 근거를 따른다. 추가 범위를 넓혀 반복 실행하지 않았다. Root의 [최종 template 새 생성](../검증/012-consumer-create-layout-final.log)은 95파일을 생성했고 생성기 검증 56개가 통과했다. [template 비교](../검증/012-consumer-layout-final-template-bytes.json)는 BrowserPanel의 정확한 bytes 일치와 OperationsTable의 독립 CSS 선언 순서 차이만 기록한다. 새 생성 결과와 이 수동 수정 앱의 실제 브라우저 검증은 별도 근거로 유지한다.

- [x] 실제 독립 소비 앱 API 다섯 그룹 확인(초기/두 번째 실행)
- [x] 최종 브라우저 전용 여덟 그룹 성공
- [x] 3운영 화면 KO/EN·390/1366 whole DOM axe 성공
- [x] 실제 window/rejection의 own1.0.0 collector 저장 확인
- [x] 모바일 긴 UUID의 옆 칸 침범 수정·geometry·PNG 확인
- [ ] 이 CLI의 정지 상태 DB scalar 검사 실행(별도 서버/JUnit 근거와 구분)
- [ ] 원격 CI·Linux cold consumer 운영 profile 실제 실행
