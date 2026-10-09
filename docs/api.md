# API 계약·앱별 명세

## 현재 화면: 디자인 교정 후보·사용자 승인 대기

001~012의 기능 구현·로컬 검증 기록은 아래에 보존한다. 현재workspace와프리뷰는 Yzen정보계층을 참고한 **디자인 교정 후보**다. [교정의 새 근거](검증/design-correction-final-summary.json)는live40검사/wholeDOMaxe14회 위반0·통합unit155/선별서버10·새JAR관련30고유 케이스·정적파일46/8해시일치·Tailnet로그인/4KPI/SVG/pageerror0이다. 새JAR생성/재시작과직접접속도 확인했다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files도 통과했다. 새패키지 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 불변 `.runtime/releases/012`의0.3.0 기능아카이브와 현재source24공개UI/candidate를 구분한다. 과거unit149/서버196·Docs22를 새교정성적으로 표시하지 않는다.

전체 [Storybook105개/30files](../.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](../.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

Reference의 로그인 후 기본 화면·`/`·미등록 URL fallback은 인증이 필요한 `/dashboard`다. 기존 `/examples` CRUD는 별도 메뉴로 유지한다. 로그인은 셸 없이 분할 화면으로 표시하며 로그인 상태·busy/error·성공 시 비밀번호 초기화 계약을 유지한다. 새 대시보드는 **샘플 매출**과 **실제 업무 현황**을 화면에 명시하여 구분한다. 매출 수치는 자체 예제 자료이고 실제 조회는 기존 권한 적용 보고서 API·Vue Query를 재사용한다. 새 업무 API endpoint는 추가하지 않는다.

## 디자인 후보의 조회·라우트 경계

`/dashboard`는 앱 화면 URL이며 새 업무 API가 아니다. [DashboardPage.vue](../frontend/apps/reference-app/src/features/dashboard/DashboardPage.vue)의 기본 `source=sample`은 매출 예제 수치를 표시하고 보고서 HTTP를 활성화하지 않는다. `source=live`에서만 기존 `GET /api/reports/requirements`와 [앱 보고서 Query](../frontend/apps/reference-app/src/features/reports/requirements/query.ts)를 사용한다. 이 조회는 현재 사용자의 공개 범위·서버 권한·기존 `page=0,size=20,sort=updatedAt,direction=desc` 계약을 따른다. 전체 `stats/total`과 현재20개 `items`를 구분하며 새 API/DTO/쿠키 세션/CSRF 계약을 만들지 않는다.

[main.ts](../frontend/apps/reference-app/src/main.ts)의 로그인 후/default/fallback 경로는 private `/dashboard`다. 기존 `/examples`와 업무 URL은 유지한다. [SPA forward](../backend/reference-app/src/main/java/dev/scframework/reference/SpaRoutes.java)는 직접 JAR URL의 `/dashboard`를 정적 앱으로 연결하고 업무 JSON endpoint를 추가하지 않는다. 운영 오류 수집은 앱 [collector route 목록](../frontend/apps/reference-app/src/features/operations/capabilities.ts)과 서버 [operations allowlist](../backend/reference-app/src/main/resources/application-operations.yml)에 `dashboard`를 함께 등록한다. 원문 URL/query/입력/오류 메시지를 telemetry에 전송하지 않는 기존7필드 계약은 유지한다.

프런트 로그인 label/상태와 auth client를 유지하며 성공 후 비밀번호를 지운다. 메뉴 검색과 사용자 native popover도 공통 단일 HTTP/Router/권한 경계를 우회하지 않는다. 새 JAR 직접 진입·인증·관련30고유 케이스와 두 원격 origin의 실제 로그인/대시보드를 확인했다. 교정 단계에서 기존 전체 운영collector 검증을 다시 실행한 것으로 표시하지 않는다.

## 기능 아카이브: 001~012 로컬 구현·검증 완료

공통 프런트5패키지 `0.3.0`·서버 `0.3.0-SNAPSHOT`이 현재 기준이다. Reference/내부 Starter의 앱 버전은 `0.1.0`, 생성 Starter v2는 `1.0.0`이며 운영 기능은 기본 OFF·선택 ON이다. Redis·JWT·SSO는 제외한다. [012 완료 기록](질의/012-운영모듈완료.md)에서 범위와 제한을 확인한다.

| 012 기능 마감 당시 확인 | 결과·근거                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 필수 통합 빌드          | [build.sh](검증/012-integration-build-final.log) PASS: unit149/36 files. [일반 서버](검증/012-integration-backend-final.json)는 총196/실행193/MQ3 skip, [별도 실제 Rabbit 검증](검증/012-backend-verify-fifth-summary.json)은196/skip0                                        |
| JAR·시각·카탈로그       | 기본 E2E71+보고서5 PASS, 별도 시각4 PASS. [Storybook](검증/012-storybook-tests-first.log)95/28 files·[Docs22/Controls10](검증/012-storybook-browser.json) PASS·브라우저 오류0. live ON/OFF 명세4비교와 neutral 타입 경계 PASS                                                 |
| 최신 운영 화면          | [다섯 번째10개](검증/012-operations-e2e-fifth.log) PASS. 모바일 UUID가 옆 셀과 겹친 앱 CSS를 수정한 최신 JAR·[JSON/PNG](검증/012-operations-e2e-fifth-results/) 기준                                                                                                          |
| 전체 DOM 접근성         | [최신 집계](검증/012-browser-axe-final.json): 운영11회·보고서9회에서 위반0/중복ID0. incomplete는 운영29규칙/143노드·보고서18규칙/245노드이며 수동 검수 미완료                                                                                                                 |
| 운영·복구·관측          | [운영18그룹](검증/012-operational-boundaries-first.json)·[복구7그룹](검증/012-runtime-recovery-third.json)·[관측8그룹](검증/012-observability-fifth.json) PASS. [Grafana](검증/012-grafana-browser-second/summary.json)는 populated metric query5·data frame11·visible panel6 |
| 독립 Starter·Docker     | [설치 소비 앱](검증/012-generated-operations-visual-final/summary.json)8그룹/axe15회·위반0/중복ID0·PNG15·UUID 셀 geometry PASS. [최신 Docker](검증/012-docker-operations-final-second.json)7그룹 PASS                                                                         |

초기 실패와 당시 진행 중 표시는 아래 이력에 보존한다. 기본71 E2E 출력은 별도 시각 실행으로 정리되어 이전 단계의 axe111회를012 성적으로 재사용하지 않는다. axe 규칙 제외0이며 incomplete·VoiceOver 실제 음성·Windows·Linux 시각 기준·원격 CI/운영 배포·HA/power-loss 보장은 미확인이다. 이 문서 갱신은 새로운 서버·브라우저 실행 결과가 아니다.

001의 중립 예제 계약을 유지하면서 007에서 Reference 사용자·메뉴·일반 요구사항·감사 API를 추가했다. 007~009 당시 결과는 칸반·공지·이미지/첨부·ADO 업무 전체 검증을 포함하지 않는다. 이 확장 업무는010에서 구현·로컬 통합 검증을 완료했고 외부 패키지/생성기는011에서 로컬 검증을 완료했다. 운영 검증은012에서 로컬 완료했다. 원본 WorkboardVue 실행 소스·SQLite·실행 자료는 레퍼런스로 유지한다.

| 명세                                                 | 생성 타입·책임                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Reference](openapi.json)                            | [Reference api.d.ts](../frontend/apps/reference-app/src/generated/api.d.ts). 현재 업무·확장 me를 앱 feature가 소비                                                            |
| [Starter](openapi-starter.json)                      | [Starter api.d.ts](../frontend/apps/starter-app/src/generated/api.d.ts). 별도 live 명세·중립 me/health/CSRF                                                                   |
| [legacy neutral compatibility](openapi-neutral.json) | [runtime api.d.ts](../frontend/packages/runtime/src/generated/api.d.ts). 앞선 중립 export 호환+실제 Starter 운영 기술 DTO. Reference 업무를 공통 runtime 타입으로 만들지 않음 |

## 001에서 보존한 기본·중립 계약

| 메서드·경로                        | 인증      | 요청·응답                                                                        |
| ---------------------------------- | --------- | -------------------------------------------------------------------------------- |
| GET `/api/health`                  | 공개      | 준비 후200 `{status: "UP", application}`; 007 Boot readiness 준비 전503/STARTING |
| GET `/api/auth/csrf`               | 공개      | `{headerName, token}`, 같은 출처 세션에 연결                                     |
| POST `/api/auth/login`             | CSRF      | form-urlencoded `username/password`, 성공 204                                    |
| POST `/api/auth/logout`            | CSRF      | 세션 종료, 성공 204                                                              |
| GET `/api/auth/me`                 | 세션      | 기본 Starter `{username,roles}`; 007 Reference 확장은 아래 별도 계약             |
| GET `/api/examples?page=0&size=20` | 세션      | `{items: [{id,title,revision}],total,page,size}`, size 1~100, id 내림차순        |
| POST `/api/examples`               | 세션·CSRF | `{title}`, 성공 201과 `{id,title,revision}`                                      |
| PUT `/api/examples/{id}`           | 세션·CSRF | `{title,revision}`, 성공 200, 현재 revision과 다르면 409                         |
| GET `/api/examples/summary`        | 세션      | `{total}`, MyBatis 연결을 확인하는 중립 예제                                     |
| GET `/api/integration/echo`        | 세션      | OpenFeign loopback mock 연동 예제; 운영 외부 서비스 설정 아님                    |

제목은 필수·최대 200자이며 저장 전에 trim한다. revision은 생성 시 1이며 수정 시 증가한다. 현재 revision과 다른 이전/미래 값 모두 409다. 저장 오류 JSON은 `{code,message,errors:[{field,message}]}`이고 성공 JSON에는 일괄 success/data 봉투를 추가하지 않는다. 400 입력 오류는 프런트 `ApiError.fields`에 연결한다. 401 인증 오류, 403 권한·CSRF 오류, 404 없음, 409 `REVISION_CONFLICT`를 구분한다.

모든 앱 업무 HTTP는 `@sc/runtime`의 client를 사용한다. 기본 `/api`, 쿠키 세션, 30초 timeout, 발급 응답의 CSRF header를 사용한다. 로그인·로그아웃·401·명시적 초기화에서 Query와 CSRF를 초기화하고 이전 세션의 응답을 폐기한다. 오류 POST를 자동 재전송하지 않는다. 서버 자료는 Vue Query, URL 선택·페이지는 Router, 저장 전 입력은 폼이 소유한다. 409 이후 입력을 보존하고 사용자가 최신 자료를 조회하도록 한다.

Swagger UI와 `/v3/api-docs`는 `dev` 프로필에서만 켠다. HttpOnly 세션 쿠키는 Swagger Authorize 입력으로 설정할 수 없다. 같은 출처에서 `/api/auth/login`을 실행하면 브라우저가 쿠키를 받고, Swagger request interceptor가 변경 요청의 CSRF를 새로 발급한다. 쿠키·CSRF·계정 값을 명세나 문서 예제에 저장하지 않는다.

명세 변경 후 각 격리 dev JAR에서 `/v3/api-docs`를 받아 해당 snapshot을 갱신하고, 환경별 server URL만 `/`로 정규화한다. `npm run api:generate`는 세 산출물을 생성하고 `npm run api:check`는 각각 일치하는지 확인한다. `npm run api:check-server`는 Reference·Starter의 실제 명세를 각각 비교한다. 의도한 변경에만 `check-openapi.py --update`와 명시 `--jar/--snapshot`을 사용한다. nullable key·required·숫자0/1·HTTP status를 지워서 snapshot을 맞추지 않으며 서버 실제 JSON·통합 검증을 함께 확인한다. Zod는 앱의 런타임 입력 규칙을 맡는다.

## 010 확장 API의 현재 계약

[010](질의/010-업무확장과파일작업실.md)은 구현·로컬 통합 검증을 완료했다. [최종 fresh 통합](검증/010-integration-build-focus-final.log)은 단위139개/34 files·서버143개를, [최종 요약](검증/010-final-summary.json)은 main69+reports5=74 E2E·axe111회 violations/중복ID0·Story95/Docs22/Controls10·별도 시각4 PASS를 확인했다. 실제 명세/생성 타입과 [두 dist/JAR46+6 바이트 일치](검증/010-server-and-artifacts-focus-final.json)를 검증했다. 아래007의 이미지 null-only는 당시 범위다. 요구사항 생성에는 screenVersionId/annotation을 함께 지정하거나 모두 null로 보낸다. 기존 이미지 요청의 박스 삭제 또는 본문 PUT의 annotation:null은 이미지 버전 연결을 유지한다. 따라서 상세 응답은 screenVersionId가 non-null이고 annotation이 null인 상태도 허용하며, 박스를 다시 지정하기 전에는 검토 요청으로 전환할 수 없다.

| 메서드·경로                                                             | 계약                                                                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/auth/password`                                               | 세션/CSRF·currentPassword/newPassword·12자 이상/UTF-8 72byte 이하. hash commit 후 현재 세션 종료204, 실패 시 session/hash 보존                 |
| GET/POST `/api/screens`, GET/POST `/api/screens/{id}/versions`          | 화면 생성 ADMIN/REVIEWER. multipart file의 실제 이미지 검사·10MB. 불변 버전·archived 숫자0/1·UTC                                               |
| POST `/api/versions/{id}/archive`, GET `/api/versions/{id}/annotations` | 기존 연결 유지·신규 요청 제한·주석 DRAFT 가시성                                                                                                |
| PUT/DELETE `/api/requirements/{id}/annotation`                          | 작성자·revision CAS·박스 하나. PUT {revision,box}/DELETE query revision                                                                        |
| POST/DELETE `/api/requirements/{id}/attachments[/{attachmentId}]`       | 작성자·revision CAS·multipart file/revision·MIME/크기·DB/blob 정리                                                                             |
| GET `/api/files/{id}`                                                   | 인증·DRAFT 첨부 비공개·no-store·이미지 inline/첨부 attachment·UTF-8 filename·원본 bytes                                                        |
| PUT `/api/requirements/{id}/ado`                                        | AGREED/ADO_LINKED 작성자 또는 지정 reviewer의 수동 ticket/url·revision·외부 호출 없음                                                          |
| GET `/api/requirements/{id}/export`                                     | 요구사항 조회 권한을 가진 로그인 actor·상태 공통·{text}. 본문/검토/이미지/요청 ID/revision의 원본 평문 서식이며 ADO ticket/url을 추가하지 않음 |
| `/api/kanban/access`, `/members`, `/boards`, `/tasks`                   | 모두 /api/kanban 하위. 현재 DB 회원/ADMIN 조회·작업 쓰기 작성자만·명세의 각 메서드/CAS                                                         |
| POST `/api/kanban/tasks/import`                                         | boardId+최대200 rows {rowNumber,input}·전부 검증 후 한 TX·원래 시트 행/필드 오류                                                               |
| `/api/kanban/notices`, `/api/documents`                                 | 평문 공지 작성자 CRUD·문서 owner-only JSON/revision·허용 grammar/크기                                                                          |
| `/api/storage-demo[/{key}]`                                             | Starter file-storage 프로필만 ADMIN/세션/CSRF·POST/GET/DELETE·현재 실행 whitelist                                                              |

Excel UI는 승인 중 중복 전송을 막고 자동 retry하지 않는다. 성공한 batch 재승인은 새 작업을 만들며 idempotency-key 구현으로 설명하지 않는다. JPEG EXIF 방향 적용 원본 좌표를 사용하고 크기 불일치 시 입력을 차단한다. PNG eXIf 방향1 외는400이다.

## 007 Reference 확장 계약

기본 me 빈은 `sc.framework.session-endpoint.enabled=false`로 끄고 Reference UserController 하나가 `{id,username,displayName,role}`을 반환한다. role은 REQUESTER/REVIEWER/ADMIN, id는 DB 숫자 ID다. 서버 응답에 password/hash·임의 roles 배열·success/data 봉투를 추가하지 않는다. 앱 runtime decoder가 검증한 사용자에서 내부 호환 roles를 계산하며 같은 세션/Query/CSRF generation을 유지한다.

| 메서드·경로                                                                       | 인증·권한                              | 요청·응답·현재 경계                                                                                                          |
| --------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/auth/me`                                                                | 세션·현재 DB actor                     | UserResponse 4개 필드                                                                                                        |
| GET/POST `/api/users`                                                             | 읽기 세션, 생성 현재 DB ADMIN+CSRF     | 목록 UserResponse[]; 생성200. username/displayName/role/password 검증, hash만 저장                                           |
| GET/POST `/api/menus`, PUT `/api/menus/{id}`                                      | 읽기 세션, 쓰기 현재 DB ADMIN+CSRF     | parentId/name/sortOrder/active. 응답 active는 숫자0/1                                                                        |
| GET `/api/requirements`                                                           | actor·DRAFT 가시성                     | q/menuId/status/authorId/screenVersionId/page/size; `{items,total,page,size}`. updatedAt DESC/id DESC·list/count 동일 가시성 |
| GET `/api/requirements/{id}`                                                      | actor·조회 권한                        | 최상위 summary 필드+관계 필드 detail. null key/배열·문자열 history snapshot 보존                                             |
| POST/PUT `/api/requirements[/{id}]`                                               | 작성자 규칙·CSRF                       | 일반 요청 입력·revision, 생성200 DRAFT/revision1, 변경200. 이미지/annotation 일반 입력은 null만                              |
| POST `/{id}/submit`, PUT `/{id}/assignee`, PUT `/{id}/review`, POST `/{id}/agree` | 작성자/담당자/ADMIN 차이·CSRF·revision | 원본 상태/권한 검사 순서·200 상세·필요한 history/review 원자성. ADMIN을 타인 본문 쓰기 권한으로 합치지 않음                  |
| POST `/api/requirements/{id}/comments`                                            | 조회 가능한 actor·CSRF                 | `{body}`, 상세200; 요청 revision/updatedAt/history를 바꾸지 않음                                                             |
| GET `/api/audit/events`                                                           | 현재 DB ADMIN                          | 신규 확장 `{items,total,page,size}`·latest timestamp/ID순. 안전한 bounded metadata만                                         |

요구사항 title200·desired20000·reason10000·referenceText/followParts10000·comment body10000 한계와 원본 similar/followParts 규칙을 앱 DTO/Service/폼 schema에서 일치시킨다. 목록은 기본 page0/size20, size1..100·page0..1,000,000·q최대200이다. q의 `%/_/backslash`는 literal로 다루고 SQL 정렬/필터 식을 클라이언트 문자열 그대로 실행하지 않는다.

낙관 충돌은409/REVISION_CONFLICT, 데이터 중복/FK는409/DATA_CONFLICT다. 공통 Advice는400/403/404/405/415/500에서도 code/message/errors[]를 유지하고 SQL·원문·stack·암호를 노출하지 않는다. 기본 인증 AUTH_FAILED/AUTH_REQUIRED와 원본 과거 LOGIN_FAILED/UNAUTHENTICATED를 혼동해 Starter 인증 코드를 바꾸지 않는다.

감사 조회의 page/size와 action/outcome/actorSubject/from/to는 제한·바인딩한다. AuditItem은 id/actorSubject/actorId/occurredAt/action/outcome/resourceType/resourceId/requestId/reasonCode이며 nullable ID/코드도 JSON key를 보존한다. outcome은 SUCCESS/FAILURE/DENIED, 본문·토큰·암호 필드는 없다. 실제 /v3/api-docs assertion에서 required10개·nullable4개·outcome enum·page bounds를 확인했다. 두 live 명세와 세 생성 타입도 일치했다.

[007 fresh 통합](검증/007-integration-build-mobile-second.log)의 서버52개(core3/autoconfigure14/Reference31/Starter4)와 unit108/23 files·8 workspace 및 별도 E2E 타입·두 새 JAR가 통과했다. [업무 포함 JAR E2E](검증/007-e2e-mobile-final.log)는41개 통과·시각4개 별도 skip, [live 명세 비교](검증/007-openapi-live-check.log)는 Reference/Starter 모두 일치했다. 모바일 목록 수정 뒤 fresh JAR·41개 E2E·axe52회·6장 업무 이미지 실제 검토까지 확인하여007 로컬 통합 검증을 완료했다. 원본 JSON/권한/상태/revision 세부 matrix·실제 결과와 남은 범위는 [007 파일럿](질의/007-요구사항파일럿.md)을 따른다.

## 008 조회·매핑·외부 응답 경계

008은 API URL/성공 JSON/쿠키 세션·CSRF/현재 DB 권한/revision/UTC 원문 계약을 유지하면서 서버 구현을 확장했고 로컬 통합 검증을 완료했다. RequirementQueryRepository의 동적 list/count는 동일 DRAFT 공개 predicate와 literal 검색·기존 페이지/정렬을 사용한다. RequirementReadMapper는 숫자0/1·nullable 관계·빈 배열·읽기 history 문자열을 보존한다. 단건/쓰기/상태 전이는 기존 Service/JPA가 소유한다. 복잡 MyBatis 보고와 N+1/성능은009에서 로컬 구현·검증을 완료했다.

공통 FeignCallBoundary는 RetryableException을504 UPSTREAM_TIMEOUT, 다른 FeignException을502 UPSTREAM_FAILURE로 매핑한다. 외부 URL·본문·예외 message/cause는 API/log에 전달하지 않는다. 앱 EchoController는 HTTP200이어도 DTO null/필수 message 없음·null·공백 및204 빈 응답을502 UPSTREAM_FAILURE로 거절한다. 이 success DTO 검사 책임은 공통 Supplier 경계 밖의 앱에 둔다. 수신 Cookie/Authorization/CSRF를 upstream에 자동 전달하지 않고 requestId만 연결한다.

[008 최종 live 비교/타입](검증/008-live-openapi-check-final.log)는 Reference/Starter 명세 두 개와 neutral/reference/starter 생성 타입 세 개가 일치함을 확인했다. 스키마·생성 타입 계약은 변경하지 않았다. [HTTP/H2 17개](검증/008-http-smoke-final.log)·서버77개·invalid success 응답4종·fresh JAR E2E41·전체 DOM axe52회도 실제 통과했다. 초기 서버76개와 실패 기록·미확인 범위는 [008](질의/008-조회매핑과외부연동.md)에 보존한다.

## 009 요구사항 보고서

`GET /api/reports/requirements`는 현재 DB actor의 공개 범위를 적용한 복잡 MyBatis 조회다. 기존 API의 URL·JSON·권한·revision은 유지한다. 응답은 `{items,total,page,size,stats}`이며 본문·이력 JSON·계정 hash를 포함하지 않는다. 항목은 id/menuId/menuName/title/status/revision/authorId/authorName/assignedReviewerId/assignedReviewerName/createdAt/updatedAt/reviewDecision/commentCount/historyCount/lastCommentAt의16개 필드다. nullable 관계·시각도 key를 유지한다.

q최대200(공백 보존·literal 검색), menuId/status/authorId/screenVersionId를 사용한다. page는 숫자0~1,000,000/default0, size는 숫자1~100/default20이다. sort는 updatedAt/title/commentCount/historyCount/lastCommentAt, direction은 asc/desc만 허용한다. 둘을 생략하면 updatedAt DESC,id DESC, sort만 지정하면 DESC, direction만 지정하면400이다. 동률은 id DESC, 최종 댓글이 없는 행은 양방향 NULLS LAST다.

stats는6개 상태 건수와 unassigned다. 같은 공개·검색 조건 전체 자료를 집계하며6개 합=total, unassigned≤total이다. 댓글·이력은 각각 선집계해 건수 증폭을 막는다. 독립 보고서 호출은 같은 DS/JPA TM의 읽기 전용 SERIALIZABLE 경계·SQL2개를 사용한다. 외부 transaction의 REQUIRED 호출은 외부 isolation을 따른다.

[009 통합 빌드](검증/009-integration-build-compact-final.log)는 서버87개·단위112개·두 fresh JAR·Swagger page/size 정수/범위/default·nullable 검토 enum 검사를 통과했다. [기존 TS AST 비교](검증/009-existing-api-type-preservation-final.json)는 path/operation/schema76개 보존, [실제 비교](검증/009-live-openapi-check-compact-final.log)는 live 명세2/타입3 일치를 확인했다. 변경 전 전체 OpenAPI snapshot은 보관되지 않아 TS 검사를 전체 JSON diff로 설명하지 않는다. 브라우저·성능·실패·최종 상태는 [009](질의/009-복잡조회와서버표.md)을 따른다.

009의 compact 최종 새 JAR [E2E46개](검증/009-e2e-compact-final.log)·[전체 DOM axe61회](검증/009-e2e-compact-final-summary.json)도 통과했다. 보고서5개는 API 첫/중간/끝 페이지·공개범위/count/stats/정렬/literal, 500→retry의 적용 URL·입력·선택 유지와 이전 조건의 지연 응답 폐기를 실제 검사한다. 신규 보고서 API는 조회만 수행하며 revision/history/audit 쓰기를 만들지 않는다. 일반 요구사항과 media/첨부/ADO 전체의 동일 API 이전 완료를 의미하지 않으며 후자는010에 남는다.

010의 검증 결과는 [최종 요약](검증/010-final-summary.json)과 [관련17 초기 실패](검증/010-e2e-final-related.log)를 함께 따른다. 관련17과 앞선 focused 결과를 전체74에 더하지 않는다. 011의 외부 tarball/Maven 소비·생성기/upgrade와012의 DB/blob 일관 복원·crash 영속 정리/감사 전달·운영 연동, 음성·Linux·원격 CI는 로컬 API 완료와 구분한다.

## 011 배포된 runtime 타입과 생성 앱 API 경계

011은 구현·로컬 검증을 완료했고 011 마감 당시 compiled common frontend0.2.0/backend0.2.0-SNAPSHOT의 cohort 전환은 기존 API·DDL을 변경하지 않는다. runtime은001~006 중립 `ApiComponents` 선언만 명시 복사하고 Reference007~010 generated schema는 앱에 남긴다.5개 tarball에 Reference DTO·업무 migration·실행 자료를 포함하지 않는다. [현재 artifact 검사](검증/011-package-artifacts-v02.json)는 npm5/Maven7, [negative25](검증/011-package-gates-v02.json)는보호128SHA불변이다. [외부 public 타입](검증/011-consumer-types-v02.json)의generic Identity/decoder/model/emit/slot·private 거절은 HTTP 성공과 별도다.

[생성 앱 Notes](질의/011-Starter생성기.md)는 자체 `/api/notes`, `/api/notes/{id}`, `/api/notes/stats`·DTO·migration을 소유한다. Querydsl 목록·JPA detail/쓰기·같은 DS/TM MyBatis 집계는 신규 앱 계약이다. API bootstrap은 새 임시 dev JAR의 live OpenAPI에서 타입을 생성하며 Reference snapshot이나 손작성 타입을 사용하지 않는다. 최초 parent/CLI property의 early repository 실패2회를 보존하고 settings active profile bootstrap 후 [cold build 세 번째](검증/011-consumer-build-third.log)의실제 Notes 서버5개를 통과했다.

공통0.1.0의 [candidate4 생성 앱](검증/011-generated-fourth/summary.json)은HTTP/H22그룹·browser7그룹을 통과했다. 실제 작성/재조회·400/409 draft/revision 보존·세션/CSRF·prod 명세 비공개·같은 Notes 재기동을 확인했다. [생성 프로필9/선택6](검증/011-generated-features-second.json)은audit/storage 활성·기본prod OFF·런처 소유권을 검사했고 최초ps fixture 실패를 남긴다. 이 검증으로 Reference의 기존 author/reviewer·이미지/칸반 권한을 대체하지 않는다.

[현재 live 명세 비교](검증/011-live-openapi-check-first.log)의Reference/Starter2개와 [생성 타입 검사](검증/011-api-types-check-first.log)의3개 산출물은 일치했다. [원본170 비교](검증/011-reference-source-preservation-first.json)는변경0이다. [upgrade 첫 실패](검증/011-upgrade-first-failure.json)는실제0.2.0 build 성공 뒤 생성 명세의 동적 서버 포트를 소스 변경으로 오인한 검증기 문제다. server URL 정규화 후 API 동일·손작성 source 변경0이며 두 번째 upgrade/rollback은 아래011 최종 기록처럼 실제 통과했다.

UI vendor strict696·자체0와 다른4 strictfalse0, compiled Story95 기능 성공과 Docs color 누락·Controls 첫 실패 수정 후 Docs22/Controls10 실제 통과는 [011 진행 검토](질의/011-배포와생성기-준비검토.md)에 구분한다. 현재fresh unit139/서버143·74 E2E·axe111의0violations/중복ID0·incomplete232/2117nodes는011 새 실행이다.010의139/143/74·static46/6·2121nodes는 당시 역사로 유지한다.011 전체 완료·Windows/음성/원격 CI·012 운영 완료를 앞당겨 표시하지 않는다.

### 011 최종 로컬 확인과 당시012 준비 경계

[compiled Story95/28 files](검증/011-stories-controls-final.log)와 [정적 Docs22/Controls10](검증/011-storybook-browser.json)은 모두 실제 통과했고 브라우저 오류/API 누출은0이다. 첫 color 누락·Controls0/10 실패는 별도 로그/report에 보존한다. [0.2.0 외부 public 소비](검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [0.2.0 생성기48](검증/011-generator-v02.json)도 통과했다. UI vendor strict696/자체0·다른4 strictfalse0의 지원 경계는 유지한다.

[실제 upgrade/rollback 두 번째](검증/011-upgrade-rollback-second/summary.json)는0.1.0→0.2.0→0.1.0을 같은H2에서 통과했고 Notes revision1/2/3, 보호 업무 source47개 변경0·API 동일(`servers`만 정규화 제외)·공통JAR 정확한 바이트·기존lock 완전 복원을 확인했다. API·DDL이 같은 cohort의 전환 결과이며 파괴적 schema migration·사용자 코드 자동 병합을 지원한 결과가 아니다. 첫 build PASS/동적 server-port guard 실패 증거는 불변 보존한다.

[외부 optional OFF JAR](검증/011-generated-optionaloff/summary.json)는 HTTP2/browser4·선택chunk 요청0을 확인했다. [격리 내부 OFF](검증/011-starter-features.json)는 기본build 불변·요청0·선택chunk2개 emitted를 확인했으므로 완전한 번들 제거로 설명하지 않는다. [생성 프로필9/선택6](검증/011-generated-features-second.json)와 기본prod OFF도 통과했다.011은 구현·로컬 검증 완료다.012는 [CI 준비 정적 검사](검증/012-preparation-ci-check.json)의 YAML·Bash36·Python3 통과만 확인했고 remoteExecution/consumerExecuted/dependencyInstallExecuted는false다. 이 문단은 011 마감 당시의 준비 기록이다. 현재 012의 구현·실제 실행 범위는 아래 012 절에서 구분한다. 원격CI·Windows·Linux시각·VoiceOver/incomplete수동은 미확인으로 유지한다.

## 012 capabilities와 운영 API

기본 OFF 명세는 [Reference default](openapi-reference-default.json)·[Starter default](openapi-starter-default.json), 운영 ON 명세는 [Reference](openapi.json)·[Starter](openapi-starter.json)다. 현재 실제 캡처는 Reference ON59paths/83schemas·Starter ON20/25이며 default는 각각47/65·6/6이다. [세 타입 생성](검증/012-api-type-generation-third.log)은 성공했다. 공통 neutral은 기존 중립 계약에 실제 Starter의 **capabilities+운영13path/참조 closure19schema**만 추가한다. 전체 neutral22paths/30schemas를19개 전체 명세라고 읽지 않는다. `scripts/neutral-openapi-operations.py`가 동일 closure와 operationId 중복을 확인하고 공통 `scOperations_method_path` ID를 사용한다.

| HTTP 경로                                                    | 권한·요청·응답                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/framework/capabilities`                            | authenticated, 항상 존재. `FrameworkCapabilities`의 messaging/scheduler/browserErrors/observability 네 boolean. 기본 모두 false |
| `GET /api/operations/messages`                               | 현재 ADMIN. page/size·등록 type/state 필터. `OperationMessagePage`                                                              |
| `POST /api/operations/messages/{eventId}/retry`              | ADMIN+CSRF, {} 또는 body 없음. DEAD/미완료 CAS202 Item, 다른 상태409·없음404. revision 필드 없음                                |
| `POST /api/operations/messages/demo`                         | ADMIN+CSRF, 고정 MESSAGE_DEMO202 Item. 임의 payload/failure 입력 없음                                                           |
| `GET /api/operations/jobs/registered`                        | ADMIN. 실제 items {jobCode,executionMode}, `OperationalRegisteredJobsResponse`                                                  |
| `GET/POST /api/operations/jobs/schedules`                    | 목록 page/size·id DESC, 생성 ADMIN+CSRF200. `OperationalSchedulePage`/`OperationalScheduleResponse`                             |
| `GET/PUT /api/operations/jobs/schedules/{id}`                | 단건 ADMIN/없음404. full input+revision 수정 ADMIN+CSRF200·stale409                                                             |
| `POST /api/operations/jobs/schedules/{id}/pause`, `/resume`  | ADMIN+CSRF {revision}, response200·stale409. 삭제/즉시실행/일반 retry API 없음                                                  |
| `GET /api/operations/jobs/runs`                              | ADMIN. page/size·선택 scheduleId, `OperationalRunPage`. RUNNING/SUCCESS/FAILED                                                  |
| `POST /api/operations/browser-errors`                        | authenticated+CSRF, 고정7필드만. 202 `{accepted:true}`·unknown/raw필드400·chunked 포함4096bytes 초과413·bounded429/Retry-After  |
| `GET /api/operations/browser-errors/groups`                  | ADMIN, source/eventCode/page/size. `BrowserErrorGroupPage`                                                                      |
| `GET /api/operations/browser-errors/groups/{id}/occurrences` | ADMIN, page/size. `BrowserErrorOccurrencePage`                                                                                  |

메시지 Item은 eventId/type/state/dispatchAttempts/nextAttemptAt/createdAt/publishedAt/completedAt/lastFailureCode만 제공한다. 등록 type은 SECURITY_AUDIT/FILE_DELETE/MESSAGE_DEMO, state는 PENDING/CLAIMED/PUBLISHED/COMPLETED/DEAD다. 원문 payload·경로·secret은 없다. 목록은 page0..1,000,000·size1..100을 사용한다.

예약 input은 `{jobCode,cron,timeZone,misfirePolicy,enabled}`, 수정은 revision을 추가한다. 등록 작업당 예약은 하나이며 중복 생성은409다. 기존 예약의 jobCode는 바꿀 수 없다. 실제 등록 code만 허용하며 cron 최대120자·Quartz6/7필드·seconds0·바깥 공백 없음, timeZone 최대64자·서버 IANA ZoneId, misfirePolicy SKIP/FIRE_ONCE다. response는 id/jobCode/cron/timeZone/misfirePolicy/enabled/revision/createdAt/updatedAt/nullable nextFireAt이다. run은 id/scheduleId/runKey/jobCode/scheduledAt/startedAt/nullable completedAt/state/nullable reasonCode/attempt다. 서버 시각은 UTC 원문이고 프런트 표시는 @sc/date로 변환한다.

오류 수집 input은 `{schemaVersion:1,clientEventId:UUID,source,eventCode,appVersion,routeCode,componentCode:'ROOT'}`다. schemaVersion은 실제 OpenAPI의 integer enum[1]이며 타입을 문자열로 우회하지 않았다. source는 VUE/WINDOW/REJECTION, code는 해당 VUE_ERROR/WINDOW_ERROR/UNHANDLED_REJECTION 또는 UNKNOWN_RUNTIME이고 Router name allowlist와 앱 자체 appVersion 설정에 맞춘다. internal 두 앱은0.1.0, v2 생성 앱은1.0.0이다. runtime factory는 최대64자 SemVer를 검사한다. 원문 message/stack/info/url/query/body/입력/쿠키/토큰은 수집하지 않는다. group은 fingerprint·version/source/code/route/component·first/last/count, occurrence는 group/actorSubject/nullable actorId/requestId·occurredAt만 제공한다. 상세 stack 원인 분석과 분산 rate limit을 지원한 결과로 설명하지 않는다.

기능 OFF는 해당 controller/feature HTTP를 활성화하지 않는다. cap Query가 성공하고 해당 flag가 ON일 때만 메뉴/요청/collector가 활성화된다. ADMIN이 아닌 인증자는 오류를 보고할 수 있지만 운영 집계/예약/메시지를 읽거나 바꿀 수 없다. UI gate와 별개로 서버가 매 요청 현재 actor를 검사한다.

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

[서버195](검증/012-backend-tests-fourth.log), [실제 두 앱 경계18그룹](검증/012-operational-boundaries-first.json)에서 권한/CSRF/409/413/429/receipt·minute PULSE·재기동을 확인했다. 프런트 입력 보존·late 응답·locale·모바일·수집기의 JAR 브라우저는 아직 통합 검증 중이며 전체012 완료로 표시하지 않는다. 세부 정책과 실패 기록은 [메시지·복구](질의/012-메시지와복구계약.md), [예약·오류](질의/012-예약과브라우저오류.md)를 따른다.

[운영 첫 브라우저10개](검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
