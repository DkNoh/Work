# 신규 프로젝트 실행·운영 기준

## 다중 DB 실행

H2 기본 외 Oracle·Db2 LUW·SQL Server·PostgreSQL을 선택하는 [DB 운영 가이드](database-support.md)를 추가했다.
드라이버를 넣는 Maven profile과 실행 `SC_DB_VENDOR`를 맞추고 URL·계정·비밀정보는 환경에서 주입한다.
기존 H2 백업/복원 스크립트를 외부 DB에 적용하지 않는다. 외부 DB의 backup/restore·TLS·schema 권한은
고객 환경에서 별도 검증한다. [이번 결과](리뷰정리.md)는 과거 001~012의 실행 기록과 구분한다.


## Windows 개발 실행기

2026-10-09 Windows 실행 오류를 확인하여 `npm run dev`에 운영체제별 진입점
`scripts/dev.mjs`를 연결했다. Windows는 `scripts/dev.ps1`, macOS/Linux는 기존 `scripts/dev.sh`를 실행한다.
Windows 개발 실행에는 JDK 21, Node.js/npm이 필요하다. Bash/Python은 사용하지 않는다.

- 실행: 프로젝트 루트의 PowerShell에서 `npm run dev`.
- 서버 소스 재빌드 후 실행: `npm run dev -- --rebuild`.
- 종료: `Ctrl+C` 또는 다른 터미널의 `npm run dev -- --stop`.
- 기본 화면/서버: `http://localhost:5175`, `http://localhost:18082`.
- `SC_HOME`은 Windows 절대 경로, 포트는 `SC_PORT`/`SC_FRONTEND_PORT`로 변경할 수 있다.
  별도 `SC_HOME`으로 실행했다면 종료 요청도 동일한 환경변수로 실행한다.
- 로그: 선택한 `SC_HOME` 아래 `logs/backend.stdout.log`, `backend.stderr.log`,
  `frontend.stdout.log`, `frontend.stderr.log`, `application.log`.
- 최초 아이디는 `admin`, 비밀번호 파일은 `secrets/bootstrap.secret`이다.
  현재 사용자 전용 ACL을 적용하고 값은 출력하거나 덮어쓰지 않는다.
- 실행기는 포트 충돌을 거부하고 `run/app.lock`을 획득한다. 자기가 시작한 Java/Vite만 종료하고
  PID/잠금 파일을 정리한다. 터미널 강제 종료/전원 차단으로 남은 잠금은 자동으로 지우지 않는다.
- Windows 종료에서는 소유 프로세스를 `Stop-Process`로 종료한다. 정상 HTTP 요청 완료를 기다리는
  운영용 graceful shutdown이나 강제 종료 시 데이터 무손실을 보장하는 실행기는 아니다.

필요한 라이브러리/JAR가 없거나 `--rebuild`를 지정하면 프런트 `npm run build`와 Maven
`-DskipTests package`를 수행한다. 개발 기동을 위한 패키징이며 전체 검증 성공으로 합산하지 않는다.
기존 Unix CI/통합 검증은 `scripts/build.sh`를 유지한다.

Windows에서 추가 확인한 호환 문제는 Java 경로의 `C:/...` 변환, 생성 토큰 SCSS의 CRLF 비교,
Maven Wrapper의 일반 디렉터리 `Target` null 처리, PowerShell 7에서 상속된 모듈 경로다.

이번 실제 검증: 프런트 빌드 성공, 단위 테스트 40파일/167개 통과, 변경 JS lint 통과,
두 실행 JAR 패키징 성공. 별도 `.runtime/windows-check`와 18195/5179에서 브라우저 로그인,
대시보드 표시, 프런트→API health 200, 실행 secret HTTP 403, 브라우저 오류 0,
재시작 로그인, 중복 포트 거부, 종료 요청 후 포트/잠금 정리를 확인했다.
Node의 SIGINT 이벤트를 통한 종료 요청과 포트/잠금 정리도 확인했다. 실제 사용자 터미널의
Ctrl+C 키 전달은 별도 미확인이며 `npm run dev -- --stop`으로도 종료할 수 있다.
기본 5175/18082에서는 실제 사용자 권한으로 실행하고 로그인 화면 표시·HTTP 200·브라우저 오류0을
확인했다. 로그인 동작 검사는 위 별도 테스트 자료에서만 수행했다.

전체 검증은 통과하지 않았다. `npm run verify`는 기존 체크아웃의 형식 검사 515파일에서
실패했으며 전체 파일 자동 재포맷은 하지 않았다. Maven `verify`는 autoconfigure 테스트
55개 중 실패1/오류3/skip3이었다. 실패는 Python Unix lockf 기반 잠금 테스트1건과
Windows 심볼릭 링크 권한이 필요한 테스트3건이며 기존 테스트를 삭제하거나 완화하지 않았다.
실제 서버 기동/개발용 패키징 성공과 전체 CI 성공은 구분한다.

## 현재 화면: 디자인 교정 후보·사용자 승인 대기

001~012의 기능 구현·로컬 검증 기록은 아래에 보존한다. 현재workspace와프리뷰는 Yzen정보계층을 참고한 **디자인 교정 후보**다. [교정의 새 근거](검증/design-correction-final-summary.json)는live40검사/wholeDOMaxe14회 위반0·통합unit155/선별서버10·새JAR관련30고유 케이스·정적파일46/8해시일치·Tailnet로그인/4KPI/SVG/pageerror0이다. 새JAR생성/재시작과직접접속도 확인했다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files도 통과했다. 새패키지 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 불변 `.runtime/releases/012`의0.3.0 기능아카이브와 현재source24공개UI/candidate를 구분한다. 과거unit149/서버196·Docs22를 새교정성적으로 표시하지 않는다.

전체 [Storybook105개/30files](../.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](../.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

Reference의 로그인 후 기본 화면·`/`·미등록 URL fallback은 인증이 필요한 `/dashboard`다. 기존 `/examples` CRUD는 별도 메뉴로 유지한다. 로그인은 셸 없이 분할 화면으로 표시하며 로그인 상태·busy/error·성공 시 비밀번호 초기화 계약을 유지한다. 새 대시보드는 **샘플 매출**과 **실제 업무 현황**을 화면에 명시하여 구분한다. 매출 수치는 자체 예제 자료이고 실제 조회는 기존 권한 적용 보고서 API·Vue Query를 재사용한다. 새 업무 API endpoint는 추가하지 않는다.

## 디자인 교정 프리뷰와 JAR 반영 상태

현재 프리뷰는 Vite `http://127.0.0.1:5176/dashboard`이며 `/api`를 `http://127.0.0.1:18082` 백엔드로 proxy한다. 새 실행 자료를 따로 복제하지 않고 기존 신규 프로젝트의 `.runtime/dev`를 사용한다. 관리자 secret 값은 문서·명령·로그에 기록하지 않는다.

| 접속 경로                                                                  | 현재 역할                                                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [로컬 Vite](http://127.0.0.1:5176/dashboard)                               | 새 Vue/UI source 후보 프리뷰·인증 후 dashboard. 업무 HTTP는 proxy를 통해 같은 세션/CSRF client 사용 |
| [Tailnet HTTPS 프리뷰](https://macstudio.tailf9bcc5.ts.net:5176/dashboard) | 현재 공유한 프리뷰 주소. 사용자 디자인 승인·최종 자동 QA와 구분                                     |
| [Tailnet JAR](http://100.120.61.117:18082/dashboard)                       | 새 프런트 포함 JAR 재시작·직접진입200·로그인/4KPI/SVG/pageerror0 실제 확인                          |

기존443·5175·8089 등 서비스 연결은 유지한다. 프리뷰용5176과 이 프로젝트가 소유한 서버18082만 목적에 맞게 관리하며 다른 앱 프로세스·개인 자료를 종료하거나 옮기지 않는다. Root가 library/UI dist→Reference/Starter 프런트→새JAR 패키징을 완료했고 Reference프리뷰를 재시작했다. [정적파일46/8해시](검증/design-correction-jar-static.json)와 [두원격origin로그인](검증/design-correction-remote-preview.json)을 실제 확인했다. `.runtime/releases/012`의 기존0.3 기능 아카이브는 재작성하지 않는다.

기존012 기능 검증·Docker/외부 소비 성공은 아래 역사 기록이다. 이번 디자인의 새스크린샷·live전체DOM14회·키보드/검색/nativeEnter·로그인/guard·새JAR관련30개는 새근거로 확인했다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files를 통과했다. 새패키지 독립설치소비와 사용자 수락은 미확인이며 기존성적을 자동승계하지 않는다. 이 문서 작업에서는 프리뷰·포트·인프라를 변경하거나 추가 브라우저 검증을 실행하지 않았다.

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

## 010 파일 저장 실행 경계

Reference는 신규 SC_UPLOAD_DIR(기본 SC_HOME/uploads)을 사용한다. 파일은 static/public에 넣지 않고 인증된 /api/files/{id}로 읽는다. DB metadata/blob의 일관된 backup/restore는012에서 실제 검증한다.

Starter는 기본 비활성이다. SC_APP=starter와 SC_PROFILE=file-storage 또는 dev/prod/audit 조합으로 선택 예제를 켠다. key whitelist는 현재 실행만 허용하고 재기동 시 이전 key는404다. 영구 업무 metadata 예제가 아니다. 기본 프로필은 endpoint/root를 만들지 않으며 Reference는 file-storage/audit를 거절한다.

[실제 Starter JAR 결과](검증/010-starter-storage.json)의8개 그룹은 여섯 활성 조합·기본 비활성·잘못된 프로필·세션/CSRF·upload/read/delete·재기동 whitelist·종료·임시 자료 삭제를 통과했다. [Reference 파일 재기동5개 그룹](검증/010-reference-media-restart.json)도 통과했으며 둘 다 clean stop/start이고 당시 crash·DB/blob backup/restore는012에 남겨 둔 미검증 범위였다. 현재 결과는 아래012 절을 따른다. 010은 [최종 fresh 통합](검증/010-integration-build-focus-final.log)의 unit139/34 files·서버143개와 [최종 브라우저/Story/시각](검증/010-final-summary.json)을 통과하여 로컬 완료했다. prod Swagger 비공개이며 secret 값을 기록하지 않았다. non-ADMIN 차단은 별도 MockMvc 두 역할 test다.

Node 24.16.0/npm 11.13.0, JDK 21, Python 3를 사용한다. Maven 3.9.16은 `backend/mvnw`가 고정한다. macOS에서는 JDK 21을 찾아 쓰며 다른 OS에서는 JAVA_HOME 또는 JAVA21_HOME으로 지정할 수 있다. 실제 실행 결과와 환경 제한은 [001 기록](질의/001-프로젝트생성.md)에 둔다.

```bash
cd /Users/dk/Work/ScFramework
npm ci
npm run verify
./scripts/build.sh
./scripts/dev.sh
```

`verify`는 형식·lint·OpenAPI 타입·프런트 타입·단위 테스트·두 앱 빌드다. `build.sh`는 npm ci와 verify 후 Maven clean verify로 새 Vue 산출물을 포함한 두 JAR를 만든다. 001 당시 UI/runtime은 workspace source exports였다. 011부터5개 package manifest는 compiled dist를 가리키며 현재012 공통 프런트 cohort는0.3.0이다. 내부 source alias 검증과 외부 tarball/JAR 실행은 별도 판정한다.

| 대상             | 기본값·책임                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue 개발 화면    | `http://127.0.0.1:5175`, SC_FRONTEND_PORT로 변경                                                                                                                                |
| Spring 개발 서버 | `http://127.0.0.1:18082`, SC_PORT로 변경                                                                                                                                        |
| Vite 프록시      | SC_API_TARGET, dev.sh가 신규 Spring 주소 지정                                                                                                                                   |
| 개발 실행 자료   | `.runtime/dev`, SC_HOME 절대 경로로 분리 가능                                                                                                                                   |
| 관리자           | username `admin`, 신규 비밀번호는 `.runtime/dev/secrets/bootstrap.secret`에서만 확인                                                                                            |
| Reference JAR    | `backend/reference-app/target/sc-reference-app.jar`                                                                                                                             |
| Starter JAR      | `backend/starter-app/target/sc-starter-app.jar`, Reference 업무 import 없음                                                                                                     |
| H2               | 신규 file DB. Reference: ddl-auto validate·앱 Flyway V1 중립/V2 사용자·요구사항/V3 감사/V4 미디어/V5 칸반·공지·문서. Starter 기본: ddl-auto none·Flyway 비활성·업무 테이블 없음 |
| Swagger 개발 UI  | `http://127.0.0.1:18082/swagger-ui/index.html`                                                                                                                                  |
| Storybook        | `npm run storybook`, 기본 6006; `npm run build-storybook`로 별도 정적 산출물                                                                                                    |

개발 최초 비밀번호는 새 파일을 600 권한으로 생성하며 값은 로그·문서에 남기지 않는다. 새 Reference DB와 기본 Starter 인증은 SC_BOOTSTRAP_SECRET_FILE 없이 임의 비밀번호를 만들어 기동하지 않는다. 007 Reference의 기존 DB 재기동은 기존 사용자/hash를 원본으로 사용하고 bootstrap 파일로 덮어쓰지 않는다. 기존 Workboard·원본의 DB·업로드·비밀번호·runtime 자료를 사용하지 않는다. 종료는 dev 터미널의 Ctrl+C다.

JAR 실행은 `./scripts/run.sh`를 사용한다. 기본 자료는 `.runtime/local`이고 SC_HOME, SC_BOOTSTRAP_SECRET_FILE을 명시한다. 최소 앱은 SC_APP=starter로 선택한다. 실행 잠금과 PID는 SC_HOME/run에 놓는다. `scripts/stop.sh`는 해당 PID의 실행 JAR를 확인하고 정상 종료한다. 강제 종료 후 남은 잠금은 프로세스 종료를 직접 확인한 뒤 정리한다. Reference는 SC_PROFILE=dev/prod로 명시하며 기본값은 dev가 아니다. Starter는 기본 dev/prod와 선택 audit/dev,audit/prod,audit, file-storage/dev,file-storage/prod,file-storage/audit,file-storage/dev,audit,file-storage/prod,audit,file-storage만 허용한다. Reference의 audit/file-storage 조합과 다른 profile은 실행 자료 생성 전에 거절한다. dev.sh는 dev 프로필과 새 SC_HOME 내부 H2를 사용한다. 프로덕션에서 dev 프로필을 설정하지 않는다.

```bash
# 새 프런트를 포함한 JAR를 먼저 만든다.
./scripts/build.sh
npm run api:check-server
python3 scripts/verify-swagger.py
python3 scripts/verify-dev-launcher.py
python3 scripts/smoke-test.py
npm run test:e2e
npm run build-storybook
npm run test:stories
```

HTTP/브라우저 검증은 임시 H2·합성 계정·별도 포트와 자료를 생성하고 종료 후 지운다. 실행 자료·secret·DB를 프런트 public나 Spring static에 넣지 않는다. Vite의 fs.deny는 `/@fs`의 `.runtime`·secret·H2 접근을 차단하며 publicDir에는 적용되지 않는다. [Vite 공식 기준](https://vite.dev/config/server-options#server-fs-deny). CHROME_BIN이 없으면 Playwright가 설치한 Chromium을 사용한다. 필요하면 `npx playwright install chromium`으로 설치한다. E2E는 Reference 18183·Starter 18184에서 각각 새 JAR를 실행하며 SC_E2E_PORT/SC_E2E_STARTER_PORT로 변경한다. 기존 실행 서버를 재사용하지 않는다. 인증 정보가 포함될 수 있는 trace는 기본 비활성화한다. 002 화면 검증은 두 앱의 390/1366/1920px 캡처를 docs/검증에 남긴다.

`check-openapi.py`는 실제 격리 dev JAR 명세와 지정 snapshot을 비교한다. Reference/Starter를 각각 검사하며 `npm run api:generate`는 앱 두 타입과 legacy neutral compatibility 타입을 별도로 생성한다. 변경이 의도된 경우에만 명시 `--jar/--snapshot/--update`를 사용하고 실제 JSON/schema와 함께 확인한다. CI는 live 명세 비교와 생성 타입 검사 모두를 수행한다. `verify-dev-launcher.py`는 임시 경로·포트에서 개발 실행과 자식 프로세스 종료를 확인한다.

## 007 사용자·준비 상태·감사 운영 경계

007의 구현·로컬 통합 검증을 완료했다. Reference는 앱 migration과 빈 DB bootstrap 뒤 DB 사용자 인증을 제공한다. 최초 ADMIN은 기존 SecretFileUsers의 파일 검증/BCrypt 결과를 재사용해 한 번 저장하고 재기동에서 기존 ID/hash/업무 FK를 유지한다. 새 운영 환경에 원본 SQLite·계정/hash를 복사하거나 SQL migration에 암호/hash를 적지 않는다. 일반 계정 생성은 ADMIN API이며 사용자/비밀번호 관리 UI 전체는010 범위다.

Boot readiness가 초기 준비를 마치기 전에는 `/api/health`가503/STARTING, 이후 기존200/UP다. migration/bootstrap 실패를 무시하고 준비 완료로 처리하지 않는다. Reference 기본 me는 앱 사용자4필드, Starter 기본 me는 username/roles이며 runtime의 해당 앱 decoder/생성 타입을 맞춘다.

Reference는 `sc.framework.audit.enabled=true`와 자체 V3로 감사 adapter를 활성화한다. 기본 Starter는 false·schema 없음이고 선택 `audit` Spring profile의 application-audit.yml/자체 V1은 별도로 공통 adapter를 소비한다. run.sh에는 Starter 전용 audit/dev,audit/prod,audit 안전 allowlist를 추가했다. 기본 앱의 dev/prod와 이 선택 범위를 구분하며, [실제 Starter 런처](검증/007-starter-audit-launcher.log)의8개 검사 그룹은 기본 schema 없음·로그인/logout/401/403·기본 me·9개 실제 감사 이벤트의 한번 저장/재기동 보존·선택 자체 V1·Swagger dev,audit 허용/prod,audit 거절·TERM/정리를 통과했다. 잘못된 profile과 Reference audit 조합은 실행 자료 없이 거절했다.

감사 SQL에는 본문·암호·cookie/session/token/hash·예외/SQL message를 보관하지 않는다. ADMIN 조회는 current DB role·bounded filters/page로 제한한다. 성공은 실제 commit 뒤 REQUIRES_NEW에 기록하고 rollback된 SUCCESS는 없다. sink 실패는 완료된 저장/HTTP를500처럼 바꾸지 않으며 고정 `AUDIT_SINK_FAILURE` warning과 failedWrites counter를 남긴다. 이 신호를 살피고 감사 누락을 운영 사고로 판단할 절차·retention/삭제·outbox/영구 전달·관측은012의 미완료 범위다.

검사는 새 임시 H2/합성 계정/파일만 사용하며 auth MockMvc의 자동 실패 출력은 NONE으로 두어 form/password를 출력하지 않는다. 006의40회 axe/16 PNG 역사 보존본과 새로운007 UI 기준을 구분한다. 007은 fresh 두 JAR·서버52·업무 포함 E2E41·fullDOM axe52회·두 live 명세/세 생성 타입을 통과했다. HTTP17·Swagger7·dev 런처18·Starter audit8개 그룹도 실제 통과했다. 최종 모바일 목록 수정 이후 새 JAR·E2E41·axe52회·업무6장 실제 검토도 통과했다.

GitHub CI와 Docker/Compose는 구성 파일을 제공한다. 로컬 검증을 원격 CI·컨테이너 실행 완료로 기록하지 않는다. Docker의 secret mount와 신규 자료 volume은 예제이며 실제 배포·HTTPS·backup/restore·운영 DB 선정은 012에서 검증한다. H2 file DB는 단일 프로세스의 개발/레퍼런스 기본값이고 복수 서버 운영 구성은 별도 결정이 필요하다.

007의 생성 시각 manifest는 Prettier 재작성으로 승인 바이트를 바꾸지 않는다. .prettierignore의 visual.spec.ts-snapshots/*/manifest.json만 제외하며 npm run visual:manifest:check가 일반 verify/CI에서 schema와 macOS16PNG 해시를 필수 검사한다. 실제 pixel 비교는 동일 환경에서 별도로 실행한다. 최신 [007 모바일 fresh 통합](검증/007-integration-build-mobile-second.log)과 [41개 JAR E2E](검증/007-e2e-mobile-final.log)를 확인했으며 axe52회의 incomplete rule instances99·수동 음성 검증은 미확인으로 남긴다.

## 008 Java processor·외부 HTTP 검증

008은 필수 scripts/build.sh·서버77/unit108·fresh 두 JAR/새 dist 바이트16·6개 일치, 부모 상속 fixture2/미매핑 실패 gate, live 명세2/타입3·HTTP17/H2 재기동·JAR E2E41/전체 DOM axe52회까지 통과해 로컬 완료했다. 최초76개 결과와 BOM/fixture 초기 실패는 별도 보존한다. run.sh의 dev/prod 및 Starter 선택 audit profile·빈 DB bootstrap·V1/V2/V3 migration·secret 경계는 바꾸지 않는다. 새 DB 이관이나 schema migration을008에서 수행한 것으로 표시하지 않는다.

```bash
python3 scripts/verify-java-processors.py
./scripts/build.sh -ntp
npm run api:check-server
python3 scripts/smoke-test.py
npm run test:e2e
```

processor verifier는 임시 fixture에서 실제 backend/pom.xml을 상속한다. 성공 compile/runtime2개·Q/Mapper class·Boot configuration metadata와 미매핑 requiredField의 의도한 compile exit1·tests 미실행을 확인하면 outer exit0이다. 실패/임시 경로 cleanup 결과를 함께 보관한다. CI에는 해당 실패 gate와008 evidence 경로를 연결했지만 실제 원격 실행은 미확인이다.

실제 두 JAR의 Hibernate6.6.53·H2 2.3.232·Querydsl JPA/Core6.12·Cloud OpenFeign4.3.3/Feign13.6.1·MapStruct1.6.3을 확인했다. Lombok1.18.46·Querydsl APT·MapStruct/Lombok/Boot compiler processor·binding0.2.0은 compile 경로만 사용하고 실행 JAR에 넣지 않는다. 008 당시 generated-sources는 Q7개/mapper1개였으며 현재 010 fresh compile은 Q18개/mapper2개다. 두 읽기 mapper는 RequirementReadMapperImpl/KanbanReadMapperImpl이고 clean compile로 재생성한다. 수동 Q/Mapper를 배포 source에 넣지 않는다. Starter에는 Reference 업무 class가 없다.

외부 URL·client 목록·connect/read timeout을 앱 설정으로 명시한다. loopback 테스트의200ms timeout과1200ms 응답 지연은 합성 fixture 전용이며 운영 timeout 기본값을 바꾸지 않는다. retry 기본값은 NEVER이며401/403/404/429/503·decoder 실패·지연은 각각1회 요청으로 검사한다. actual refused target은 별도 closed loopback port를 사용하고 공유 listener를 중간 종료하지 않는다. Cookie/Authorization/CSRF 및 response body/password/token canary의 API/log 미노출·MDC requestId를 확인한다. 실제 사용자 계정/DB/secret이나 운영 외부 API를 테스트에 연결하지 않는다.

## 009 보고서 격리 검증

별도 보고서 테스트는18185(`SC_REPORT_E2E_PORT`), 새 임시 H2·합성10,000건·`frontend/test-results-reports`를 사용한다. 최초 migration/bootstrap JAR는 임의 포트에서 한 번 실행 후 종료하고 실제 JAR의 H2 library로 빈 업무 DB에 offline INSERT한 뒤 재기동한다. 생산 seed endpoint/profile과 실제 사용자 자료를 사용하지 않는다. `.runtime/e2e-reports.json`은0600 metadata이며 새 비밀번호 파일 경로만 보관하고 종료 시 정리한다.

```bash
npm run test:e2e   # 기존 기능 후 보고서 전용 검증
npm run test:reports
```

SERIALIZABLE 읽기는 통계/페이지 일관성 검사에 사용한다. H2 동시 쓰기 전체의 직렬 동등성이나 offset 비용 상수를 보장하지 않는다.10k 측정은 각 페이지1회 관측이며 반복 벤치마크·운영 SLA가 아니다. [009 실측·초기 실패](질의/009-복잡조회와서버표.md)를 확인한다. 009 당시 CI evidence stage는009였고 현재 [.github/workflows/verify.yml](../.github/workflows/verify.yml)은010이다. Starter 파일 검사·보고서·010 evidence를 연결하고 YAML 실제 파싱을 확인했지만 원격 CI 실행은 미확인이다.

009의 최종 [compact 새 JAR](검증/009-integration-build-compact-final.log)는 서버87·unit112/24 files·두 실행 JAR를 생성했다. [JAR E2E](검증/009-e2e-compact-final.log)의 기존41+보고서5=46 PASS/시각4 SKIP, [전체 DOM axe](검증/009-e2e-compact-final-summary.json)의61회0violations/중복ID0·incomplete117 및 보고서12 PNG 실제 검토를 확인해 로컬 완료했다. [HTTP17/H2 재시작](검증/009-http-smoke-final.log)은 compact UI 변경 전의 동일 backend 새 JAR 검사이고, [명세2/생성 타입3](검증/009-live-openapi-check-compact-final.log)는 compact 최종 JAR로 재확인했다. [현재 JAR/dist](검증/009-server-and-artifacts-final.json)의 Reference20/Starter6파일 바이트 일치도 확인했다.

보고서 fixture 최초 기동은 미지원 H2 RunScript `-charset`로 실패했고 [초기 E2E](검증/009-e2e-initial.log)를 보존한다. 실제 runtime library2.3.232의 CLI `-options "CHARSET 'UTF-8'"`로 수정하여 [격리 seed/restart/API/정리](검증/009-report-fixture-repair.json)를 통과했다. 50100은 H2ErrorCode이며 SQLState가 아니다. 숫자 error code만 출력하고 SQL·계정 hash·비밀 파일 내용은 출력하지 않는다.

공통 macOS 시각 비교는 별도4 PASS·의도한1436pixel 실패 gate를 확인했다. 새 메뉴 추가의 초기18928pixel actual/diff를 직접 검토하고 명시한009 run으로만 기준을 갱신했으며 006/007 frozen 보존본은 유지한다. Linux 기준·원격 시각CI·VoiceOver 음성·axe incomplete 수동 검토·운영 Compose/backup/restore는 미확인으로 남는다.011 버전 전환은 아래 실제 성공 기록과 구분한다. 외부0.1.0 생성 앱의 실제 JAR/브라우저 성공은 아래011 기록과 구분한다. Docker daemon 사전 점검과 pack 내용 검사는 아래의011 실제 결과다. 010은 구현·로컬 통합 검증을 완료했고 011 패키지/생성기와012 운영도 구현·로컬 검증을 완료했다.

## 011 클린 소비·012 복원과 영속 처리 인계

[011 준비 검토](질의/011-배포와생성기-준비검토.md)는 내부 UNLICENSED 패키지의 로컬 tarball 다섯 개·격리 Maven repository 소비·새 빈 경로 Starter·upgrade/rollback을 검증 대상으로 둔다. 현재 compiled exports와 내부 source alias 검증의 성공을 클린 외부 전체 실행 성공으로 합산하지 않는다. 공개 npm 게시나 원격 사내 registry 운영은 별도 결정이다.

012는 Reference H2 metadata와 blob의 일관된 백업 세트·새 경로 복원·권한/revision/실제 다운로드 재확인, 프로세스 중단의 orphan·영속 삭제 큐/재시도, 감사 durable 전달/outbox·retention을 실제 실패/재기동으로 검사한다. 현재 afterCommit 파일 삭제의 bounded warning/counter와 감사 failedWrites는 운영 신호이며 crash 복구 보장이 아니다. [파일 수명 계약](질의/010-파일저장계약.md)과 [조건부 전체 범위](질의/조건부기술-전체구현.md)의 RabbitMQ/H2 outbox-inbox·Quartz JobStore·Prometheus/Grafana·OTLP/Tempo·브라우저 오류/Loki·Docker/Compose readiness/종료/복원도 함께 인계한다. 실제 실행 전 버전·환경·명령을 고정하고 실패/미확인을 기록하며 Redis/JWT/SSO는 제외한다.

## 010 최종 통합·실패 보존과 남은 운영 검증

[최종 scripts/build.sh](검증/010-integration-build-focus-final.log)는 exit0이며 unit139/34 files·서버143개를 실제 다시 실행했다. [서버 보존본](검증/010-integration-focus-final-reports/summary.json)은 core3/auto27/Reference105/Starter8, failures/errors/skips0이다. [최종 산출물](검증/010-server-and-artifacts-focus-final.json)은 두 JAR hash·Reference46/Starter6 static 파일의 바이트 일치와 obsolete extra0·compiler library0·Starter Reference업무class0·Q18/Mapper2를 확인한다. 이전 [clean -DskipTests package](검증/010-jar-static-package-final.log)는 당시 프런트 정적 파일 재포장만 수행했고 서버143을 새로 실행한 결과가 아니다. 최신 최종 full build의 실행과 구분한다.

[non-clean 패키징 최초 검사](검증/010-artifact-static-initial.json)는 Reference dist46/JAR66·obsolete extra20으로 실패했다. 이를 clean 패키징으로 해결한 기록과 [관련17 초기15 PASS/2 FAIL](검증/010-e2e-final-related.log)을 보존한다. 최신 [기능/접근성 요약](검증/010-final-summary.json)은 main69+reports5=74 PASS, main에서 시각4 SKIP를 제외하고 별도 정상 시각4 PASS, 전체 DOM axe111회 violations/중복ID0·incomplete232/2121nodes다. 관련17과 앞선 focused15는 전체 run에 포함되므로 별도 더하지 않는다. native canvas Escape의 실제4 assertion은 source/log로 확인했으며 list reporter가 inline JSON body attachment를 저장한 해시 파일은 없다.

Story95/28 files·정적 build·공개 Docs22/Controls10·오류/API누출0을 통과했다. [시각 승인/negative](검증/010-visual-approved.json)은 초기19054pixel1 FAIL/3 PASS→명시 갱신4 PASS·1PNG+manifest 변경, 최종 정상4 PASS/baseline변경0·고의1436pixel1 FAIL/17baseline SHA 불변이다. VoiceOver 음성·incomplete 수동 검토·Linux/원격 CI·실제 Compose·운영 DB/blob 복원·crash 영속 정리/감사 durable·MQ/스케줄러/관측은 아직 검증하지 않았다.

### 011 현재 배포·외부 실행 상태

011은 구현·로컬 검증을 완료했다. 011 마감 당시 frontend common은0.2.0/backend common은0.2.0-SNAPSHOT이며 앱 자체 버전·API·DDL을 바꾸지 않는다.5개 library의 compiled ESM/선언·UI 단일 CSS/Sass·계약22·stamp/digest를 사용한다. 소비 install에서 prepare/prepack로 재컴파일하지 않는다. `scripts/build-library.mjs <frontend/packages/...>` 뒤 `package-framework.mjs`가 현재 source/config/helper digest와 격리 Maven repository를 검사해 새 output을 포장한다. 원래0.1.0 release와 실패 세트를 덮어쓰지 않는다.

[현재 pack](검증/011-package-artifacts-v02.json)은 npm5/Maven7 PASS, [negative25](검증/011-package-gates-v02.json)는보호128SHA불변이다. [생성기 최신48경계](검증/011-generator-v02.json)·template61/새 target74파일은 설치/secret/서버 실행 없이 생성한 결과다. 생성 앱은 자기 최초 install/lock·npm ci·API bootstrap·production build·Maven clean verify를 수행한다. 첫 두 Maven early-model repository 실패 이후 settings active profile bootstrap을 수정한 [세 번째 cold build](검증/011-consumer-build-third.log)는 실제 서버5개까지 통과했다.

공통0.1.0의 [candidate4 생성 JAR](검증/011-generated-fourth/summary.json)는 HTTP/H22그룹·[production browser7그룹](검증/011-generated-fourth/browser/summary.json)을 통과했다. 전체 DOM axe4는violations/중복ID0이고 PNG4는 루트가 직접 검토했다. secret600·세션/CSRF·prod Swagger 비공개·Notes 재기동·임시 runtime 정리를 포함한다. [선택 프로필9그룹](검증/011-generated-features-second.json)은 기본 prod OFF·선택6조합·런처/PID 소유권을 확인했다. [최초 ps fixture 실패](검증/011-generated-features-first.json)를 보존하며 정상 stop/start를 crash 복구로 설명하지 않는다.

`verify-generated-app.py --consumer <새 앱> --label <증거 이름> --patterns on|off`, `verify-generated-features.py --app <새 앱> --label <증거 이름>`은 루트가 독립 생성 앱을 검사하는 진입점이다. `.github/workflows/verify.yml`의 `package-consumer` job은 cold build·외부 타입/native/Sass·production JAR/browser·generated profiles9를 실행하도록 구성했으며 원격 실행은 하지 않았다. 증거에는 공개 package/로그/JSON/PNG만 포함하고 runtime secret·H2·업로드를 내보내지 않는다.

[외부 타입](검증/011-consumer-types-v02.json)은native4/type12/private3/XLSX/Sass PASS다. UI strict own-source/skipLibCheck true와 vendor strict696(Vuetify695/libDOM1) 실패를 구분하고 다른4는skipLibCheck false로0이다. [현재 fresh 통합](검증/011-server-and-artifacts-first.json)의unit139/서버143·static35/5와 [main69+reports5](검증/011-e2e-first.log)·[axe111](검증/011-e2e-axe-summary.json)의0violations/중복ID0·incomplete232/2117nodes, [정상 시각4/기준17불변](검증/011-visual-final.json)을 확인했다.010의 static46/6·2121nodes 기록은 유지한다. compiled [Story95](검증/011-stories-first.log)는 기능 통과했지만 [Docs 첫 color 누락](검증/011-storybook-browser-first.log)은 별도 실패다. 공개 계약 adapter 작성 이후 Docs22/Controls10 실제 재검증은 통과했다.

`verify-package-upgrade.py --consumer <새 앱> --from-artifacts <0.1 세트> --to-artifacts <0.2 세트> --label <이름>`는 같은 앱·H2의 upgrade/rollback을 확인한다. [첫 실행 실패](검증/011-upgrade-first-failure.json)는 upgrade build 성공 뒤 동적 OpenAPI 서버 포트를 source 변경으로 센 guard 오류이며 정규화 API 동일·손작성 source 변경0이다. [첫 archive](검증/011-upgrade-rollback-first/summary.json)는 보존했고 두 번째 실제 전환·rollback은 통과했다.

[Docker 사전 점검](검증/011-docker-daemon-preflight.json)은Engine29.5.3/linux arm64 응답만 확인했다. 011 당시 image pull/container start는false였다.012의 실제 인프라/복구 결과와 앱 컨테이너 마감 대기는 아래 절에서 구분한다. Windows·VoiceOver·incomplete 수동 확인·Linux 시각·원격 CI도 미확인으로 남긴다.

### 011 최종 로컬 확인과 당시012 준비 경계

[compiled Story95/28 files](검증/011-stories-controls-final.log)와 [정적 Docs22/Controls10](검증/011-storybook-browser.json)은 모두 실제 통과했고 브라우저 오류/API 누출은0이다. 첫 color 누락·Controls0/10 실패는 별도 로그/report에 보존한다. [0.2.0 외부 public 소비](검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [0.2.0 생성기48](검증/011-generator-v02.json)도 통과했다. UI vendor strict696/자체0·다른4 strictfalse0의 지원 경계는 유지한다.

[실제 upgrade/rollback 두 번째](검증/011-upgrade-rollback-second/summary.json)는0.1.0→0.2.0→0.1.0을 같은H2에서 통과했고 Notes revision1/2/3, 보호 업무 source47개 변경0·API 동일(`servers`만 정규화 제외)·공통JAR 정확한 바이트·기존lock 완전 복원을 확인했다. API·DDL이 같은 cohort의 전환 결과이며 파괴적 schema migration·사용자 코드 자동 병합을 지원한 결과가 아니다. 첫 build PASS/동적 server-port guard 실패 증거는 불변 보존한다.

[외부 optional OFF JAR](검증/011-generated-optionaloff/summary.json)는 HTTP2/browser4·선택chunk 요청0을 확인했다. [격리 내부 OFF](검증/011-starter-features.json)는 기본build 불변·요청0·선택chunk2개 emitted를 확인했으므로 완전한 번들 제거로 설명하지 않는다. [생성 프로필9/선택6](검증/011-generated-features-second.json)와 기본prod OFF도 통과했다.011은 구현·로컬 검증 완료다.012는 [CI 준비 정적 검사](검증/012-preparation-ci-check.json)의 YAML·Bash36·Python3 통과만 확인했고 remoteExecution/consumerExecuted/dependencyInstallExecuted는false다. 이 문단은 011 마감 당시의 준비 기록이다. 현재 012의 구현·실제 실행 범위는 아래 012 절에서 구분한다. 원격CI·Windows·Linux시각·VoiceOver/incomplete수동은 미확인으로 유지한다.

## 012 선택 운영 프로필과 로컬 인프라

012는 **구현·로컬 검증 완료**다. 기본 dev/prod는 messaging/scheduler/browserErrors/observability OFF이며 broker/OTLP 연결 없이 기존 앱을 실행한다. 두 앱의 `operations`, `dev,operations`, `prod,operations` 프로필이 기능과 앱 소유 migration을 함께 선택한다. dev.sh는 dev 또는 dev,operations를 허용한다. Reference는 기존 V1~V5에 운영 V6/V7, 내부 Starter는 audit V1+운영 V2/V3, framework0.3 생성 Starter v2는 Notes V1/audit V2/운영 V3/V4를 사용한다. migration을 공통 JAR에 업무 DDL로 합치지 않는다.

다음은 새로운 개인 운영 root를 준비하고 자신의 Compose project만 켜는 실행 예다. secret 값은 명령에 넣지 않는다. 기존 runtime을 입력으로 사용하거나 덮어쓰지 않는다.

```bash
python3 scripts/prepare-operations.py --home "$PWD/.runtime/operations"
SC_OPERATIONS_HOME="$PWD/.runtime/operations" \
  docker compose -p scframework-operations -f compose.operations.yaml up -d

# 새 프런트가 포함된 JAR를 먼저 빌드한 뒤 실행한다.
SC_HOME="$PWD/.runtime/operations" SC_PROFILE=dev,operations ./scripts/run.sh

# 다른 터미널에서 해당 앱의 실행 JAR/PID를 확인하여 정상 종료한다.
SC_HOME="$PWD/.runtime/operations" ./scripts/stop.sh
SC_OPERATIONS_HOME="$PWD/.runtime/operations" \
  docker compose -p scframework-operations -f compose.operations.yaml down
```

`prepare-operations.py`는 새 빈 canonical root만 받으며 root/하위 폴더700·새 regular secret600을 만든다. `spring.rabbitmq.password`, `observer.secret`, `grafana.secret`와 RabbitMQ private conf를 configtree/secret mount로 소비한다. 컨테이너 app 예제는 `--profile app`으로 따로 선택한다. `down`은 해당 project에 한정하며 데이터 volume 삭제를 기본 절차에 넣지 않는다. secret·H2·uploads·runtime metadata를 CI artifact/public/static에 넣지 않는다.

| 대상                      | 로컬 연결·역할                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- |
| RabbitMQ 4.3.6-management | 127.0.0.1:5679 AMQP / 15679 management. quorum queue·confirm/return·manual ACK·DLQ |
| Prometheus 3.13.4         | 127.0.0.1:19090. 별도 observer 인증으로 management18482 scrape                     |
| Collector Contrib 0.162.0 | 127.0.0.1:4319 OTLP HTTP / 13133 readiness. allowlist trace/log 수집               |
| Tempo 3.1.0 / Loki 3.7.8  | 127.0.0.1:13200 / 13100. trace·정제 operational log 저장/조회                      |
| Grafana OSS 13.2.3        | 127.0.0.1:13000. private 관리자 secret·3datasource/6panel provisioning             |
| 선택 Reference 컨테이너   | app profile, 127.0.0.1:19082. prod,operations·별도 application volume              |

정확한 tag·digest는 [compose.operations.yaml](../compose.operations.yaml)이 원본이고 [실제 arm64 image pull](검증/012-images-pulled-second.json)과 [6개 인프라 readiness](검증/012-compose-up-second.log)가 확인됐다. 앱 Dockerfile의 [두 번째 build 실패](검증/012-docker-app-build-second.log)는 보존하며 아래의 세 번째 build·네 번째 앱 컨테이너7그룹 성공과 구분한다. 로컬 JAR·인프라 데이터 연결 성공과 원격 운영 배포/HTTPS/HA는 별개다.

메시지는 outbox→confirm→inbox/effect commit→ACK를 사용한다. handler 최초+재전달은 최대5회이며 DEAD를 자동 업무 재실행하지 않는다. ADMIN의 명시 retry만 상태 CAS로 재개한다. 삭제와 감사도 같은 업무 TX의 outbox에 참여하며 완료 자료만 bounded retention으로 정리한다. Quartz는 같은 DS/JpaTM의 JDBC JobStore를 사용하고 실제 등록 코드만 예약한다. 등록 작업당 예약은 하나다. 기본 system 예약3개는 처음만 만들고 재기동에서 수정/paused/revision을 덮지 않는다. PULSE는 자동 예약 없이 등록 코드만 제공하며 첫 예약 후에는 기존 예약을 변경한다. 상세는 [메시지·복구](질의/012-메시지와복구계약.md), [예약·오류](질의/012-예약과브라우저오류.md)에 있다.

[실제 복구7그룹](검증/012-runtime-recovery-third.json)은 Java NIO/Python lockf 상호 배타·실제 저장 adapter child SIGKILL·정지 H2/uploads/journal·새 빈 root의 같은 JAR/Flyway 검사·PNG/PDF hash/revision/inbox 보존·변조/비어있지 않은 target 거절·복원 후 영속 삭제/참조 원본 보호를 확인했다. 백업은 `backup-runtime.py`, 복원은 `restore-runtime.py`이며 실행 중 runtime/원본 Workboard 자료·secret·세션을 복제하지 않는다. power loss·원격 FS·다중 서버·Windows 잠금은 이 POSIX 프로세스 crash 검증에 포함되지 않는다. confirm/ACK JVM crash2개는 [서버195 전체 실행](검증/012-backend-tests-fourth.log)에서 별도 검증했다.

[운영 HTTP/H2 18그룹](검증/012-operational-boundaries-first.json)은 Reference9/Starter8/정리1로 권한·CSRF·409·4KiB chunked413·receipt 동시 집계·429·실제 minute PULSE 효과·같은H2 재기동을 확인했다. [관측7그룹](검증/012-observability-third.json)은 Prometheus `up`/JVM/Hikari/HTTP histogram/고정 event, SC_SERVER ancestor→Feign CLIENT의6span, trace 연결 Loki1log, Grafana3 실제 datasource query와 secret canary0/log600을 확인했다. 이 JSON의 `manualReviewComplete=false`는 유지하며 Grafana 화면/음성/수동 검수를 완료로 읽지 않는다.

운영 E2E는 `npm run test:operations`·[별도 config](../frontend/playwright.operations.config.ts)로 18193/18194의 새 두 JAR와 별도 임시 H2를 사용한다. Root harness의 격리 DEAD fixture→UI retry→broker 완료 검사는 실제 첫5회 실패→DLQ 검사를 대체하지 않는다. trace는 OFF다. 기본 E2E에는 [OFF 검사](../frontend/e2e/012-operations-off.spec.ts)를 포함하고 ON spec을 제외한다. 신규 운영 프런트의10개 E2E·OFF2개는 작성/타입/lint까지 확인됐으며 실제 JAR 브라우저·whole DOM axe·시각·pack/v2 소비·컨테이너/최종 종합 결과는 검증 중이다. 이전001~011 기록은 그대로 보존한다.

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

[운영 첫 브라우저10개](검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
