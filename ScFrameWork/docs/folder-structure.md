# ScFramework 구조와 책임

## 013 공통 디자인 규격 수정 위치

[013 공통 디자인 프레임워크](질의/013-공통디자인프레임워크.md)의 공통 규격·Reference/Starter·Storybook·별도 후보 로컬 검증은 완료했다. 독립 소비 앱의 실제 브라우저도 확인했으며 사용자 수락은 미확인이다. 현재18082 서버는 보존했고 새 후보는TCP18083·Storybook HTTPS6007이다. 아래 대시보드 교정 기록은 이전 단계의 근거이며 013 성적으로 합산하지 않는다.

| 위치                                                                                   | 책임                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `frontend/packages/ui/src/ScActionButton.vue`, `contracts.ts`                          | 버튼 size/intent/icon 공개 규격과 기존 busy/disabled 계약 |
| `frontend/packages/ui/src/inputs/`, `ScTextField.vue`                                  | 공통 입력 밀도·toolbar 선택·오류/readonly/form 계약       |
| `frontend/packages/ui/src/patterns/contracts.ts`, `ScSectionCard.vue`, `ScKpiCard.vue` | 카드 밀도·표면·KPI compact 공개 규격                      |
| [ScStatusBadge.vue](../frontend/packages/ui/src/patterns/ScStatusBadge.vue)            | 정적 상태 텍스트·7가지 의미 tone·토큰 색상·대비           |
| `frontend/packages/ui/src/table/`                                                      | 표 밀도·caption 표시·최소 너비·선택/페이지 계약           |
| `frontend/apps/catalog/src/`, `templates/starter-v2/frontend/src/`                     | 규격별 Storybook 상태·Controls와 생성 앱의 공개 부품 소비 |

## 이전 화면: 대시보드 디자인 교정 후보·사용자 수락 미확인

001~012의 기능 구현·로컬 검증 기록은 아래에 보존한다. 현재workspace와프리뷰는 Yzen정보계층을 참고한 **디자인 교정 후보**다. [교정의 새 근거](검증/design-correction-final-summary.json)는live40검사/wholeDOMaxe14회 위반0·통합unit155/선별서버10·새JAR관련30고유 케이스·정적파일46/8해시일치·Tailnet로그인/4KPI/SVG/pageerror0이다. 새JAR생성/재시작과직접접속도 확인했다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files도 통과했다. 새패키지 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 불변 `.runtime/releases/012`의0.3.0 기능아카이브와 현재source24공개UI/candidate를 구분한다. 과거unit149/서버196·Docs22를 새교정성적으로 표시하지 않는다.

전체 [Storybook105개/30files](../.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](../.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

Reference의 로그인 후 기본 화면·`/`·미등록 URL fallback은 인증이 필요한 `/dashboard`다. 기존 `/examples` CRUD는 별도 메뉴로 유지한다. 로그인은 셸 없이 분할 화면으로 표시하며 로그인 상태·busy/error·성공 시 비밀번호 초기화 계약을 유지한다. 새 대시보드는 **샘플 매출**과 **실제 업무 현황**을 화면에 명시하여 구분한다. 매출 수치는 자체 예제 자료이고 실제 조회는 기존 권한 적용 보고서 API·Vue Query를 재사용한다. 새 업무 API endpoint는 추가하지 않는다.

## 대시보드 디자인 교정 후보의 파일 책임

| 위치                                                                                                                                                                                                                                                                                       | 책임                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [DashboardPage.vue](../frontend/apps/reference-app/src/features/dashboard/DashboardPage.vue)                                                                                                                                                                                               | 앱 소유 대시보드·Router `source`/`period`·샘플 매출·기존 보고서 Query·권한 적용 실제 자료·업무 바로가기                                   |
| [ScKpiCard.vue](../frontend/packages/ui/src/patterns/ScKpiCard.vue)                                                                                                                                                                                                                        | 중립 KPI 표시·추세·아이콘. 업무 조회·매출 API·권한을 소유하지 않음                                                                        |
| [ScSeriesChart.vue](../frontend/packages/ui/src/charts/ScSeriesChart.vue), [chart 계약](../frontend/packages/ui/src/charts/contracts.ts)                                                                                                                                                   | 중립 다중 series 차트·읽기 전용 자료·SFC template·공개 `@sc/ui/charts` 진입점                                                             |
| [ScAppShell.vue](../frontend/packages/ui/src/layout/ScAppShell.vue), [ScShellNavigation.vue](../frontend/packages/ui/src/layout/ScShellNavigation.vue), [types.ts](../frontend/packages/ui/src/layout/types.ts)                                                                            | 인디고 브랜드240px/헤더68px·흰 toolbar·80px 접기·icon/group·`header-leading` slot·모바일 native dialog·skiplink/focus·실측 header/cleanup |
| [tokens.ts](../frontend/packages/ui/src/tokens.ts), [theme.ts](../frontend/packages/ui/src/theme.ts), [styles.scss](../frontend/packages/ui/src/styles.scss)                                                                                                                               | 공통 색·여백·레이아웃 토큰의 단일 원본과 theme/CSS. 생성 SCSS와 실제 토큰 검사 연결                                                       |
| [App.vue](../frontend/apps/reference-app/src/App.vue), [LoginPage.vue](../frontend/apps/reference-app/src/features/auth/LoginPage.vue)                                                                                                                                                     | 앱 메뉴/권한·실제 메뉴 검색·언어·identity 아바타/native popover·로그아웃·분할 로그인                                                      |
| [main.ts](../frontend/apps/reference-app/src/main.ts), [localization.ts](../frontend/apps/reference-app/src/localization.ts)                                                                                                                                                               | private dashboard route·기본/fallback 연결·앱 메시지. 업무·세션 경계는 기존 runtime 사용                                                  |
| [capabilities.ts](../frontend/apps/reference-app/src/features/operations/capabilities.ts), [operations profile](../backend/reference-app/src/main/resources/application-operations.yml), [SpaRoutes.java](../backend/reference-app/src/main/java/dev/scframework/reference/SpaRoutes.java) | `dashboard` 수집 route allowlist와 JAR SPA forward. 새 업무 조회 endpoint 없음                                                            |

Source-only scoped 검사와 최종 브라우저/JAR 검증은 구분한다. 이번 문서 작업에서는 서버·빌드·브라우저를 실행하지 않았다.

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

001에서 생성한 구조에 002의 디자인 토큰·공통 셸, 003의 공개 UI 계약, 004의 Storybook 문서/기능 검증을 추가했다. 001~004의 **구현·로컬 검증을 완료**했으며 [001](질의/001-프로젝트생성.md)·[002](질의/002-디자인토큰.md)·[003](질의/003-공통UI계약.md)·[004](질의/004-Storybook.md)에 실제 결과와 초기 실패를 유지한다. [005 중립 공통 UI·확장 모듈](질의/005-공통입력과화면패턴.md)과 [006 기능·접근성·시각 회귀](질의/006-기능접근성시각회귀.md)도 구현·로컬 통합 검증을 완료했다. [007 파일럿](질의/007-요구사항파일럿.md)도 구현·로컬 통합 검증을 완료했고 008 조회·매핑·외부 연동도 구현·로컬 통합 검증을 완료했고 [009 복잡 조회·서버 표](질의/009-복잡조회와서버표.md)도 구현·로컬 통합 검증을 완료했으며 010은 구현·로컬 통합 검증을 완료했고 011 배포·생성기는 구현·로컬 검증을 완료했고 012 운영도 구현·로컬 검증을 완료했다. 최신 실행 범위는 문서 상단의012 결과를 따른다.

```text
ScFramework/
  package.json / package-lock.json    npm workspaces와 단일 lock
  frontend/packages/ui/              Sc core/입력/폼/patterns·table/charts/editor/board/image·토큰
  frontend/packages/runtime/         HTTP·Query·Pinia·세션·코드 기반 오류 수집·중립 타입
  frontend/packages/i18n/            ko/en 공통 메시지·독립 Composition factory
  frontend/packages/excel/           XLSX 순수 workbook adapter·자체 오류/제한 타입
  frontend/packages/date/            UTC 원문·달력 날짜·locale/zone 표시 adapter
  frontend/apps/reference-app/       중립 예제·007 요구사항 파일럿·앱 생성 타입
  frontend/apps/starter-app/         공통 모듈만 소비하는 최소 Vue 앱
  frontend/apps/catalog/             Storybook 카탈로그·모의 자료
  backend/framework-core/            공통 오류·서버 계약·중립 보안 감사 SPI
  backend/framework-autoconfigure/   Spring 기술 설정·소비 앱 override
  backend/framework-spring-boot-starter/ 의존성 진입점
  backend/reference-app/             H2 중립 예제·DB 사용자/요구사항·앱 감사 조회
  backend/starter-app/               업무 없는 최소 서버 소비 앱
  scripts/                          개발·빌드·JAR/E2E·library/pack·타입/Starter 생성
  templates/starter-v1/             011의 공통0.1/0.2용 보존 Starter template
  templates/starter-v2/             공통0.3용 중립 Notes·선택 operations template
  infra/operations/                Rabbit/Prometheus/Collector/Tempo/Loki/Grafana 설정
  compose.operations.yaml          digest 고정 로컬 운영 인프라·선택 앱 컨테이너
  docs/질의/                        단계·개발 요청
  docs/검증/                        실제 실행 기록
  .runtime/                         신규 실행 자료·Git 제외
```

UI/runtime/서버 Starter가 reference-app을 import하지 않는다. 앱별 업무는 `features/`와 해당 서버 업무 패키지에 둔다. 프런트 build 출력은 각 앱 `dist`, 서버 JAR 출력은 각 앱 `target`이며 Storybook 결과는 카탈로그에 별도로 보관한다.

실행 검증의 진입점은 `scripts/smoke-test.py`(HTTP/H2), `verify-swagger.py`(브라우저 CSRF), `verify-dev-launcher.py`(개발 기동/종료), `check-openapi.py`(실제 명세/snapshot), `frontend/e2e/framework.spec.ts`(JAR 폼 흐름), `frontend/e2e/layout.spec.ts`(두 앱 3개 폭·탐색·입력 보존)이다. 공통 격리 서버 수명은 `scripts/_harness.py`가 관리한다.

## 010 추가 파일의 책임

010은 구현·로컬 통합 검증을 완료했다. [최종 fresh 통합](검증/010-integration-build-focus-final.log)의 unit139/34 files·서버143개와 [산출물](검증/010-server-and-artifacts-focus-final.json)의 Reference46/Starter6 dist/JAR 파일 바이트 일치·obsolete extra0·Q18/Mapper2를 확인했다. [최종 요약](검증/010-final-summary.json)은 main69+reports5=74 E2E PASS·전체 DOM axe111회 violations/중복ID0·Story95/28 files·공개 Docs22/Controls10·별도 정상 시각4 PASS다. 작성·초기 실패·제한은 [010 단계](질의/010-업무확장과파일작업실.md)에 보존한다.

| 위치                                                                          | 책임                                                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `frontend/packages/ui/src/board/`, `image/`                                   | ScSortableBoard/ScImageAnnotator 공개 subpath·이동/좌표 emit·센서/Observer 정리·업무 API 없음 |
| `frontend/apps/reference-app/src/features/kanban/`                            | 보드/회원/작업·URL·Query·폼·원자적 Excel staging                                              |
| `features/notices/`, `features/documents/`                                    | 평문 공지·허용 JSON 서식 문서·revision                                                        |
| `features/admin/`, `features/account/`                                        | 사용자/메뉴/감사·본인 비밀번호                                                                |
| `features/media/`                                                             | 화면/불변 버전·Blob decode·박스/첨부/ADO 폼                                                   |
| `features/requirements/RequirementWorkspace.vue`                              | 각 폼의 기준 revision·저장/명시 조회/409 보존                                                 |
| `shared/useDraftGuard.ts`, `shared/validation.ts`                             | Router 미저장 확인·Zod 오류. 기존 requirements guard는 re-export                              |
| `features/reports/requirements/ReportChart.vue`                               | 전체 필터 stats ECharts·대체 표                                                               |
| `frontend/apps/starter-app/src/features/patterns/`                            | 독립 BoardPatterns/ImagePatterns 소비                                                         |
| `backend/framework-core/.../storage/`, `framework-autoconfigure/.../storage/` | opaque key/stream SPI·선택 local adapter                                                      |
| `backend/reference-app/.../media/`, `kanban/`, `notices/`, `documents/`       | 앱 DTO/권한/TX·metadata·V4/V5                                                                 |
| `backend/starter-app/.../storage/`, `application-file-storage.yml`            | 선택 SPI 소비·현재 실행 whitelist                                                             |
| `scripts/verify-starter-storage.py`, `frontend/e2e/010-*.spec.ts`             | 실제 프로필/업무/권한 검증                                                                    |

## 002 디자인 파일의 책임

| 실제 파일                                                                                                                                                    | 책임                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [ui/src/tokens.ts](../frontend/packages/ui/src/tokens.ts)                                                                                                    | 색·간격·타이포·반경·그림자·breakpoint·레이아웃 값의 단일 원본 `uiTokens`       |
| [ui/scripts/generate-tokens.mjs](../frontend/packages/ui/scripts/generate-tokens.mjs)                                                                        | TypeScript 원본에서 CSS custom property와 Sass breakpoint 생성·일치 검사       |
| [ui/src/tokens.scss](../frontend/packages/ui/src/tokens.scss)                                                                                                | 생성된 CSS/Sass 산출물. 직접 수정하지 않음                                     |
| [ui/src/theme.ts](../frontend/packages/ui/src/theme.ts)                                                                                                      | 같은 `uiTokens`를 사용하는 Vuetify 색·한국어 locale·display·기본 컴포넌트 설정 |
| [ui/src/styles.scss](../frontend/packages/ui/src/styles.scss)                                                                                                | 토큰 CSS 방출·공통 본문/카드/간격·focus·reduced motion                         |
| [ui/src/layout/ScAppShell.vue](../frontend/packages/ui/src/layout/ScAppShell.vue)                                                                            | header/sidebar/main·모바일 dialog·본문 skiplink·slots 조립                     |
| [ui/src/layout/ScShellNavigation.vue](../frontend/packages/ui/src/layout/ScShellNavigation.vue)                                                              | 셸 내부의 공통 탐색 링크. `aria-current`·일반 선택 emit·새 탭 동작 유지        |
| [ui/src/layout/types.ts](../frontend/packages/ui/src/layout/types.ts), [layout/index.ts](../frontend/packages/ui/src/layout/index.ts)                        | `ScAppShellNavItem` 계약과 셸 export. 내부 탐색 부품은 공개 export에서 제외    |
| [Reference App.vue](../frontend/apps/reference-app/src/App.vue)                                                                                              | 현재 route·세션에 맞는 메뉴와 로그아웃, 공통 셸 소비                           |
| [Starter App.vue](../frontend/apps/starter-app/src/App.vue)                                                                                                  | 자체 시작 route·메뉴를 공통 셸에 전달. Reference 앱 import 없음                |
| [DesignTokens.stories.ts](../frontend/apps/catalog/src/DesignTokens.stories.ts), [ScAppShell.stories.ts](../frontend/apps/catalog/src/ScAppShell.stories.ts) | 실제 토큰과 셸의 카탈로그·긴 한국어·키보드·모바일 상태 예제                    |

`@sc/ui`는 컴포넌트/타입/theme/tokens 객체, `@sc/ui/styles`는 공통 스타일, `@sc/ui/tokens`는 생성된 Sass 진입점이다. 소비 앱의 SCSS는 공개 Sass 진입점으로 breakpoint를 참조한다.

두 앱의 업무 페이지는 셸의 단일 `main` 안에 `section`으로 들어간다. 중립 예제 폼과 API는 Reference `features/`에, Starter의 입력·서버 상태 확인은 Starter에 남는다. 셸은 runtime·Router·계정·업무 API를 import하지 않는다.

다국어의 주입 경계는 002에서 정리했고 005에서 @sc/i18n·한국어/영어·공통/앱 메시지·Vuetify locale 연결을 구현했다. 각 앱 App.vue는 locale를 document.lang과 Vuetify current에 연결한다. 전체 앱/JAR 전환 검증은 [005](질의/005-공통입력과화면패턴.md)에 확정한다.

## 003 공개 UI 계약과 소비 경계

| 실제 파일                                                                   | 책임                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [ui/src/ScActionButton.vue](../frontend/packages/ui/src/ScActionButton.vue) | 버튼 label·busy/disabled·native button type·click 계약. 저장 API·권한은 앱이 소유                |
| [ui/src/ScTextField.vue](../frontend/packages/ui/src/ScTextField.vue)       | 문자열 model·label·오류/설명·readonly/disabled·native 입력 계약. 업무 schema·폼 상태는 앱이 소유 |
| [ui/src/contracts.ts](../frontend/packages/ui/src/contracts.ts)             | 버튼/입력의 공개 Props·Emits·Slots·값 타입·ScHtmlAttrs와 내부 HTML attrs 필터                    |
| [ui/src/layout/types.ts](../frontend/packages/ui/src/layout/types.ts)       | 셸 Props·Emits·Slots와 읽기 전용 메뉴 항목·배열 계약                                             |
| [ui/src/index.ts](../frontend/packages/ui/src/index.ts)                     | 컴포넌트·공개 타입·theme·토큰 객체의 package 진입점                                              |
| [ui/package.json](../frontend/packages/ui/package.json)                     | `@sc/ui`, `@sc/ui/styles`, `@sc/ui/tokens` exports와 workspace/peer 계약                         |
| [UI 공개 계약](질의/UI-공개계약.md)                                         | 실제 props/defaults·events·slots·HTML 속성·책임·사용 SFC·변경/폐기 정책                          |
| [003 단계 기록](질의/003-공통UI계약.md)                                     | 작성한 계약과 실제 통합 확인·실패/수정·남은 범위의 구분                                          |

UI 내부의 helper·탐색 부품은 `src/` 직접 import를 위한 공개 계약이 아니다. 앱과 카탈로그는 public exports를 사용한다. 001의 source exports는 역사 기록이며 현재 manifest는 compiled dist를 가리킨다. 내부 source alias 개발과 외부 tarball 소비를 구분하고 011의 외부0.1.0 JAR/브라우저·현재0.2.0 소비와 upgrade/rollback 성공은 각각 실제 증거로 구분한다.

003의 기본 계약은 버튼·문자열 입력·앱 셸이며 005의 입력·화면 패턴과 table/charts/editor 공개 subpath로 확장했다. Excel·다국어는 별도 중립 패키지가 맡는다. 전체 단계의 구현/검증 범위는 [조건부 기술 전체 구현](질의/조건부기술-전체구현.md)을 유지한다. Redis·JWT·SSO는 제외한다.

## 004 카탈로그와 계약 검증의 책임

| 실제 파일                                                                                 | 책임                                                                                           |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Catalog main.ts](../frontend/apps/catalog/.storybook/main.ts)                            | Vue3/Vite·imported 타입 docgen·UI 포함 tsconfig·Vue 컴파일러/metadata plugin 순서              |
| [Catalog preview.ts](../frontend/apps/catalog/.storybook/preview.ts)                      | 공통 Vuetify/styles·공개 계약 snapshot 연결·Controls 분류·MSW 초기 API fallback·axe error gate |
| [tsconfig.docgen.json](../frontend/apps/catalog/tsconfig.docgen.json)                     | Catalog와 UI 원본을 함께 포함하는 문서 추출 설정. main의 경로는 프로젝트 루트 기준             |
| [public-contract-arg-types.ts](../frontend/apps/catalog/src/public-contract-arg-types.ts) | compiled 공개 import를 유지하며 생성 계약22개의 props/defaults/events/slots를 Docs에 연결      |
| [Catalog stories/fixtures](../frontend/apps/catalog/src)                                  | SFC 예제·합성 상태·play 검증·Controls 연결. 업무 앱의 API/세션을 import하지 않음               |
| [ui-contracts.mjs](../scripts/ui-contracts.mjs), [ui-contracts.json](ui-contracts.json)   | 실제 공개 props/events/slots/defaults 추출과 승인한 snapshot의 drift 차단                      |
| [check-ui-boundaries.mjs](../scripts/check-ui-boundaries.mjs)                             | 공개 UI/core·subpath와 중립 패키지 소비·private import 및 공통 패키지의 앱 import 차단         |
| [verify-storybook.mjs](../scripts/verify-storybook.mjs)                                   | 정적 Storybook의 실제 Docs/Controls/ID/API 격리 확인·캡처·서버/브라우저 종료                   |

004의 정적 Docs 검사는 3개 기본 공개 컴포넌트의 계약을, 22개 story tests는 play/axe를 확인했다. 005 확장 source는 81개 Story/25 files·20 공개 UI Docs/8 Controls 검증을 완료했고 006에서도 재실행했다. Docs와 story 실행은 서로 대신하지 않는다. 006의 앱 axe·macOS 시각 회귀는 로컬 통과했으며 Linux 시각/원격 CI는 미실시다. 각 실행 결과와 초기 실패는 [004 기록](질의/004-Storybook.md)·[005 기록](질의/005-공통입력과화면패턴.md)·[006 기록](질의/006-기능접근성시각회귀.md)에 남긴다.

## 005 확장 모듈과 두 소비 앱

005에서 검증한 npm workspaces는 공통 패키지 4개와 앱 3개, 총 7개였다. 007에서 @sc/date를 추가한 현재 구조는 공통 패키지 5개와 앱 3개, 총 8개다. UI main export에는 inputs/forms/patterns를 포함하고 무거운 table/charts/editor는 공개 subpath로 분리한다. 모든 공통 모듈은 앱을 import하지 않으며 두 앱끼리도 업무/메시지 source를 import하지 않는다.

| 실제 파일/폴더                                                                                                                                         | 책임·공개 경계                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [UI inputs](../frontend/packages/ui/src/inputs), [forms](../frontend/packages/ui/src/forms)                                                            | Select/Checkbox/TextArea·FormActions/ConfirmDialog와 공개 타입·native form/ARIA. @sc/ui에서 소비                                           |
| [UI patterns](../frontend/packages/ui/src/patterns)                                                                                                    | PageHeader/SearchPanel/SectionCard/ErrorPanel/EmptyState/LoadingState/ListDetailLayout. 앱의 조회/폼/선택 상태를 props/events/slots로 조립 |
| [UI table](../frontend/packages/ui/src/table)                                                                                                          | @sc/ui/table. TanStack v9 표 모델·Virtual 측정·안정적 키·native 표와 페이지 대안                                                           |
| [UI charts](../frontend/packages/ui/src/charts)                                                                                                        | @sc/ui/charts. 선/막대 내부 옵션·토큰·대체 표·자체 선택 event·resize/dispose                                                               |
| [UI editor](../frontend/packages/ui/src/editor)                                                                                                        | @sc/ui/editor. 자체 JSON/링크 schema·Tiptap OSS·입력/상태·수명                                                                             |
| [i18n/src](../frontend/packages/i18n/src)                                                                                                              | @sc/i18n. ko/en commonMessages·앱별 createScI18n·fallback/누락 진단; 저장소/앱 상태 없음                                                   |
| [excel/src](../frontend/packages/excel/src)                                                                                                            | @sc/excel. XLSX write/read·열/값/크기 검사·행별 오류; 파일 UI/업무 저장 없음                                                               |
| [Reference patterns](../frontend/apps/reference-app/src/features/patterns), [Starter patterns](../frontend/apps/starter-app/src/features/patterns)     | 각 앱의 lazy /patterns. 로컬 폼·표/Virtual 10,000행·차트·JSON·Excel 다운로드/import staging을 독립 조립                                    |
| [Reference localization](../frontend/apps/reference-app/src/localization.ts), [Starter localization](../frontend/apps/starter-app/src/localization.ts) | 앱별 app.* 메시지·독립 locale. App.vue가 셸 labels/Vuetify current/document.lang을 연결                                                    |
| [Reference ExamplesPage](../frontend/apps/reference-app/src/features/examples/ExamplesPage.vue)                                                        | 기존 API page/size 목록을 server ScDataTable에 연결. create/edit VeeValidate·FormActions·미저장 ConfirmDialog                              |
| [005 입력/폼](질의/005-입력폼계약.md), [005 표/가상화](질의/005-표가상화계약.md), [005 확장](질의/005-확장모듈계약.md)                                 | 실제 public 타입/defaults·기능/접근성·focused 검증과 남은 통합 범위                                                                        |

PatternForm은 VeeValidate의 입력 원본과 Zod safeParse를 조립하며 API 저장은 Examples가 담당한다. TablePatterns는 client 표/선택/가상 범위를 소유한다. ExtensionPatterns는 XLSX의 canonical `Name/Quantity/UTC/Note` header와 staged rows/errors·명시 반영/취소·Object URL 수명을 소유한다. 파일의 열 이름을 locale로 바꾸지 않는다. 두 앱은 중립 패키지를 공유하면서 각자의 입력/locale/선택 자료를 유지한다.

005 최종 fresh 통합은 7 workspace typecheck·84 unit/17 files·두 앱 프런트/JAR·15 서버 검사를 확인했다. 전체 81 Story·20 공개 UI Docs/8 Controls·18 새 JAR E2E와 WorkboardVue 기준 149개 SHA 변경 0은 [005](질의/005-공통입력과화면패턴.md)에 기록한다. 006 시각/앱 axe·007 이후 업무·011 외부 배포·012 운영 완료와 구분한다.

## 실행 설정과 후속 회귀 파일

| 실제 파일                                                                                                                                                                 | 책임                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Starter config.ts](../frontend/apps/starter-app/src/config.ts), [main.ts](../frontend/apps/starter-app/src/main.ts), [App.vue](../frontend/apps/starter-app/src/App.vue) | VITE_SC_PATTERNS_ENABLED=false 빌드에서 패턴 route/메뉴 제외. 기본 앱 정상·optional chunk 요청 0, JS/CSS 2개 출력은 유지 |
| [verify-starter-features.mjs](../scripts/verify-starter-features.mjs)                                                                                                     | 격리된 비활성 빌드/브라우저 검증. 기본 앱 dist 불변과 요청/route/메뉴 확인                                               |
| [patterns.spec.ts](../frontend/e2e/patterns.spec.ts)                                                                                                                      | 두 새 JAR의 한영 입력·dirty/reset·10,000행·차트/JSON·XLSX staging/명시 반영·로그아웃 확인                                |
| [visual.spec.ts](../frontend/e2e/visual.spec.ts), [verify-visual-baselines.mjs](../scripts/verify-visual-baselines.mjs)                                                   | 006의 명시 시각 실행·동일 OS/브라우저/font·16 PNG/hash/profile·document clip·legend/축 겹침 검사                         |
| [verify-framework-gates.mjs](../scripts/verify-framework-gates.mjs)                                                                                                       | 006 실제 CLI negative 검사. 임시 fixture/snapshot·원본 hash·finally cleanup                                              |

UI snapshot은 format 2/defaultSpecified로 미기재 기본값과 명시 null을 구분한다. check-ui-boundaries의 --root와 ui-contracts의 --snapshot은 임시 자료 검사 입력이며 기본 위치는 그대로다. 다른 shared의 private 경로도 차단하고 같은 패키지 내부 import는 허용한다. 계산형 dynamic import/CJS/Sass @import/복수 script/tsconfig 별칭 전체 resolver까지 구현된 것은 아니다. [007 조사](질의/007-요구사항계약조사.md)는 후속 업무 구현의 입력 자료이며 actor DTO 등 업무 코드의 완료를 뜻하지 않는다.

## 007 요구사항·날짜·감사의 실제 소유 위치

007의 source 구현과 로컬 통합 검증을 완료했다. 아래 위치가 작성되었다는 사실과 최신 프런트가 포함된 JAR·업무 E2E·최종 명세 검증의 완료를 구분한다. [fresh 통합](검증/007-integration-build-mobile-second.log)은 서버52·unit108/23 files·8 workspace+별도 E2E/helper 타입·두 새 JAR를 통과했다. [전체 JAR E2E](검증/007-e2e-mobile-final.log)41개와 [fullDOM axe](검증/007-jar-a11y-mobile-final-summary.json)52회도 통과했다. 감사 DTO metadata assertion·두 live 명세/세 생성 타입·Starter audit 실제 런처를 확인했다. 모바일 목록 수정 후 새 JAR·41개 E2E·52회 axe·업무6장 실제 검토까지 통과하여007 로컬 완료로 기록한다. [파일럿 기록](질의/007-요구사항파일럿.md)에 실패와 남은 운영/수동 검증 항목을 함께 둔다.

| 실제 파일/폴더                                                                                                                                                                                                                                                                                                                                                                                                                      | 책임                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [date/src](../frontend/packages/date/src), [date package](../frontend/packages/date/package.json)                                                                                                                                                                                                                                                                                                                                   | 공개 @sc/date·Day.js adapter·달력/UTC raw·ko/en/IANA 표시. Vue·vendor 객체·앱 DTO를 공개하지 않음                       |
| [runtime.ts](../frontend/packages/runtime/src/runtime.ts), [Reference identity](../frontend/apps/reference-app/src/auth/identity.ts)                                                                                                                                                                                                                                                                                                | generic runtime의 decodeIdentity 확장과 앱 numeric ID/displayName/role 검증. 기본 Starter username/roles 유지           |
| [Reference generated types](../frontend/apps/reference-app/src/generated/api.d.ts), [Starter generated types](../frontend/apps/starter-app/src/generated/api.d.ts), [runtime compatibility types](../frontend/packages/runtime/src/generated/api.d.ts)                                                                                                                                                                              | 각 앱 live snapshot과 legacy neutral compatibility의 세 생성 산출물. Reference 업무를 runtime의 공통 타입에 합치지 않음 |
| [Reference requirements](../frontend/apps/reference-app/src/features/requirements)                                                                                                                                                                                                                                                                                                                                                  | API·Query·schema·권한·본문/검토/댓글/이력·dirty 가드·목록/상세. Router/Query/폼의 원본 경계 유지                        |
| [Starter DatePatterns](../frontend/apps/starter-app/src/features/patterns/DatePatterns.vue), [Catalog DateFormat](../frontend/apps/catalog/src/DateFormat.stories.ts), [합성 SFC](../frontend/apps/catalog/src/fixtures/DateFormatStory.vue)                                                                                                                                                                                        | 서로의 앱 업무를 import하지 않는 날짜 소비 예제·locale/zone/경계값 검증                                                 |
| [Reference identity](../backend/reference-app/src/main/java/dev/scframework/reference/identity), [menu](../backend/reference-app/src/main/java/dev/scframework/reference/menu), [requirements](../backend/reference-app/src/main/java/dev/scframework/reference/requirements)                                                                                                                                                       | DB 사용자 bootstrap/auth·현재 actor/role·메뉴·JPA 요구사항·상태/revision/history 원자성·업무 OpenAPI metadata           |
| [Reference V2](../backend/reference-app/src/main/resources/db/migration/V2__requirements_baseline.sql), [V3](../backend/reference-app/src/main/resources/db/migration/V3__security_audit.sql)                                                                                                                                                                                                                                       | 사용자/메뉴/요구사항 FK와 revision·마이크로초 UTC·감사 별도 schema/index. 감사에는 사용자/요구사항 FK를 두지 않음       |
| [core audit](../backend/framework-core/src/main/java/dev/scframework/core/audit), [ScAuditAutoConfiguration](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/ScAuditAutoConfiguration.java), [audit adapters](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/audit)                                                                                                  | immutable event/publisher/sink SPI·Clock/backoff·명시 활성·JDBC·commit 뒤 새 transaction·bounded 진단. DDL은 앱 소유    |
| [CommonEndpoints](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/web/CommonEndpoints.java), [DefaultSessionEndpoints](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/web/DefaultSessionEndpoints.java)                                                                                                                                                              | readiness health/CSRF와 선택 가능한 기본 me를 분리. Reference의 앱 me와 중복하지 않음                                   |
| [ScSecurityAutoConfiguration](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/ScSecurityAutoConfiguration.java), [ApiExceptionHandler](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/web/ApiExceptionHandler.java)                                                                                                                                                  | 기존 session/CSRF·HTTP status/code/errors를 유지하며 인증/거절/안전한 오류를 한 번 감사                                 |
| [Reference AuditController](../backend/reference-app/src/main/java/dev/scframework/reference/audit/AuditController.java)                                                                                                                                                                                                                                                                                                            | 현재 DB ADMIN 조회·bounded 페이지/필터·안전한 자체 DTO. 업무 API와 별도 신규 확장                                       |
| [Starter audit profile](../backend/starter-app/src/main/resources/application-audit.yml), [Starter own migration](../backend/starter-app/src/main/resources/db/audit-migration/V1__security_audit.sql)                                                                                                                                                                                                                              | 기본 비활성 Starter의 선택 활성·동일 H2/JDBC 소비. Reference Entity/migration을 import하지 않음                         |
| [공통 감사 설정 테스트](../backend/framework-autoconfigure/src/test/java/dev/scframework/autoconfigure/AuditAutoConfigurationTest.java), [transaction 테스트](../backend/framework-autoconfigure/src/test/java/dev/scframework/autoconfigure/SecurityAuditTransactionTest.java), [Reference 감사 테스트](../backend/reference-app/src/test/java/dev/scframework/reference/audit), [Starter 테스트](../backend/starter-app/src/test) | 설정 override·commit/rollback·실제 H2·필터/권한·committed HTTP와 sink 실패·민감값 제외·명세 assertion                   |
| [요구사항 E2E](../frontend/e2e/requirements.spec.ts), [검토 E2E](../frontend/e2e/requirements-review.spec.ts), [합성 자료 수명](../frontend/e2e/support/requirements.ts)                                                                                                                                                                                                                                                            | 새 JAR의 실제 작성·검토·dirty/late 응답·CSRF/권한·한영/날짜 회귀. 작성과 최종 실행 결과를 구분                          |
| [E2E tsconfig](../frontend/tsconfig.e2e.json)                                                                                                                                                                                                                                                                                                                                                                                       | npm run typecheck:e2e로 모든 E2E/helper TypeScript를 검사. global typecheck는 8 workspace와 이 별도 검사 모두를 수행    |

Starter audit 런처의 안전한 profile allowlist는 scripts/run.sh가 소유한다. [실제 런처](검증/007-starter-audit-launcher.log)는8개 그룹·9개 감사 이벤트/재기동·선택 V1·me/Swagger·정리를 통과했다. 이미지/주석·첨부·canvas·칸반·공지·관리 화면은 010 범위다. 복잡 업무 조회와 MyBatis/Querydsl·성능은 008/009에서 같은 DataSource와 기존 JSON을 유지하며 확장한다.

## 006 실제 앱·실패 gate·시각 CI

| 실제 파일/폴더                                                                                                   | 책임                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [accessibility.spec.ts](../frontend/e2e/accessibility.spec.ts)                                                   | 새 두 JAR의 8개 접근성 흐름·40회 전체 문서 axe 검사. rule/DOM 제외 없이 원본 결과 보존                         |
| [Catalog negative](../frontend/apps/catalog/negative), [verify-a11y-gate.mjs](../scripts/verify-a11y-gate.mjs)   | 정상 81 Story와 분리된 이름 없는 버튼 1개의 실제 addon-a11y 실패 확인. 기대 내부 exit1을 outer verifier가 검사 |
| [006 검토 기준 보존본](검증/006-visual-approved-baseline), [현재 기준](../frontend/e2e/visual.spec.ts-snapshots) | 006의 검토한 16 PNG/manifest 역사와 이후 사용할 환경별 기준을 구분                                             |
| [verify.yml](../.github/workflows/verify.yml)                                                                    | 기존 검사에 framework negative/a11y negative/Starter off/Docs·Controls/JAR axe 연결. 원격 실행 미확인          |
| [visual.yml](../.github/workflows/visual.yml)                                                                    | workflow_dispatch 전용. 같은 repo 승인 artifact/run ID/manifest SHA-256을 받아 Linux 동일 환경에서 비교만 실행 |
| [006 실제 기록](질의/006-기능접근성시각회귀.md)                                                                  | 26 JAR E2E·40 axe·16 PNG/4 비교·24 CLI·negative gates·초기 실패와 미확인 범위                                  |

006에서 `ScTableLabels.listScrollRegion?`과 두 앱 영어 labels를 추가하여 목록과 scroll region 이름을 구분했다. native JSON summary는 32px 높이/44px 폭·list-item marker를 유지하며 내부 차트의 legend/axis 간격도 보완했다. 이 변경은 [005 표 계약의 006 후속 변경](질의/005-표가상화계약.md#006-접근성-후속-변경)과 006 실제 결과에서 확인한다. 006 당시 외부 pack/생성기·Docker는 미확인이었고 현재 011의 실제 중간 결과는 아래에 구분한다. VoiceOver 음성·Linux·원격 workflow·실제 Compose는 아직 미확인이다.

## 008 조회·코드 생성·외부 연동 위치

[008 기록](질의/008-조회매핑과외부연동.md)은 필수 fresh 통합·서버77/unit108·새 JAR E2E41/전체 DOM axe52·부모 상속 fixture2/실패 gate·live 명세2/타입3·HTTP17·원본170개 변경0을 통과하여 로컬 완료했다. Q7/mapper1·컴파일 전용 라이브러리0·Starter 업무 class0·새 dist/JAR 파일16/6개 바이트 일치도 확인했다.

| 실제 파일·폴더                                                                                                                                                                                                                                            | 책임                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [backend/pom.xml](../backend/pom.xml)                                                                                                                                                                                                                     | fork 전용 sc-querydsl.version6.12·MapStruct1.6.3·Lombok1.18.46/binding0.2.0·Compiler3.14.1의 JDK21 processor 조합. provided Lombok의 Boot JAR 명시 제외 |
| [ScQuerydslAutoConfiguration](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/ScQuerydslAutoConfiguration.java)                                                                                                            | 단일/primary EMF의 transaction-bound factory 기본값·소비 bean backoff. 업무 predicate는 가져오지 않음                                                   |
| [FeignCallBoundary](../backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/integration/FeignCallBoundary.java)                                                                                                                    | timeout/network504·upstream502의 안전한 공통 경계. 앱의 성공 DTO 검증은 앱 책임                                                                         |
| [RequirementQueryRepository](../backend/reference-app/src/main/java/dev/scframework/reference/requirements/RequirementQueryRepository.java)                                                                                                               | 현재 DB actor의 DRAFT 공개 범위·동적 조건·동일 predicate count·안정적 정렬/페이지                                                                       |
| [RequirementReadMapper](../backend/reference-app/src/main/java/dev/scframework/reference/requirements/RequirementReadMapper.java)                                                                                                                         | 읽기 DTO와 UTC/nullable/숫자0·1/배열·history 문자열 보존. 상태·revision 쓰기는 기존 Service                                                             |
| backend/reference-app/target/generated-sources/annotations                                                                                                                                                                                                | 현재 010 APT 산출물 Q18개·mapper2개(RequirementReadMapperImpl/KanbanReadMapperImpl). 수동 구현·소스 커밋 없이 clean compile로 재생성                    |
| [혼합 persistence 검사](../backend/reference-app/src/test/java/dev/scframework/reference/requirements/RequirementMixedPersistenceTest.java), [Feign 검사](../backend/reference-app/src/test/java/dev/scframework/reference/ReferenceIntegrationTest.java) | 같은 DS/EMF/JpaTM·flush/history·commit/rollback/감사·권한, 실제 loopback 지연/상태/decoder/연결 거절·민감값 미노출                                      |
| [verify-java-processors.py](../scripts/verify-java-processors.py)                                                                                                                                                                                         | 실제 부모 POM을 상속하는 임시 성공 fixture와 미매핑 compile 실패 fixture. 수동 Q/Mapper·설정 복제 없이 생성·runtime·정리 확인                           |

Reference의 동적 Entity 조회와 DTO 매핑은 앱 소유다. Starter는 공통 설정만 소비하고 Reference class를 포함하지 않는다. 009의 업무 MyBatis join/보고·N+1/count/성능 확장은 구현·로컬 통합 검증을 완료했고 010의 추가 업무도 구현·로컬 통합 검증을 완료했다. 위의 008 당시 Q7/mapper1 성적은 역사적 결과로 보존한다.

## 009 복잡 보고서와 서버 표

| 위치                                                                                                          | 책임                                                                 |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `backend/reference-app/src/main/java/dev/scframework/reference/reports/`                                      | 보고서 Controller/DTO/Service·MyBatis Mapper·nullable enum 명세 설정 |
| `backend/reference-app/src/main/resources/dev/scframework/reference/reports/RequirementReportSqlMapper.xml`   | 공개·검색 조건/선집계·고정 정렬·통계/page SQL                        |
| `backend/reference-app/src/test/java/dev/scframework/reference/reports/RequirementReportIntegrationTest.java` | 권한/JSON/정렬/snapshot/혼합 TX/10k·EXPLAIN                          |
| `frontend/apps/reference-app/src/features/reports/requirements/`                                              | generated 타입 API/Query·URL parser·필터 폼·서버 표·페이지           |
| `frontend/e2e-reports/requirements-report.spec.ts`                                                            | 실제10k JAR API/화면/접근성·지연 응답 검사                           |
| `frontend/playwright.reports.config.ts`                                                                       | 분리된 포트/결과·테스트 수명                                         |
| `scripts/e2e-report-server.py`, `scripts/seed-report-fixture.py`                                              | 신규 H2 bootstrap/offline seed/재기동/정리                           |

공통 ScDataTable은 공개 prop을 유지하며 서버 전체 행 ARIA를 표현한다. 업무 SQL/DTO/권한은 공통 모듈에 넣지 않는다. [009 결과](질의/009-복잡조회와서버표.md)를 함께 확인한다.

009는 [최종 fresh 통합](검증/009-integration-build-compact-final.log) 서버87·unit112/24 files·두 JAR, [46개 E2E](검증/009-e2e-compact-final.log)·[61회 전체 DOM axe](검증/009-e2e-compact-final-summary.json)·[보고서12장 실제 이미지 검토](검증/009-visual-review.json)를 통과하여 로컬 완료했다. 브라우저 metadata는 `.runtime/e2e-reports.json`만 사용하고 일반 E2E DB/포트18183·18184와 보고서18185를 분리한다. `frontend/test-results-reports`는 생성 output이며 source format/lint에서만 제외한다. 실제 보고서 source·타입·전체 DOM axe를 제외하지 않는다.

## 011 배포·생성기와 012 운영 인계

현재 다섯 프런트 패키지는 compiled exports를 제공한다. 내부 workspace source aliases와 실제 tarball 소비는 다른 검증이다. [011 진행 검토](질의/011-배포와생성기-준비검토.md)는 실제 pack·생성기·외부 타입의 성공과 외부 JAR/브라우저·upgrade/rollback의 실제 로컬 성공과 남은 운영 실행을 구분한다. 자체 패키지는 내부 UNLICENSED 정책을 유지하며 공개 npm 게시를 필수로 두지 않는다. 원본 업무 migration·DTO·실행 자료를 생성 앱에 복사하지 않는다.

012는 [파일 수명 인계](질의/010-파일저장계약.md)의 crash orphan·영속 삭제 큐/재시도·DB metadata와 blob의 일관된 백업/복원, [감사 운영](operations.md)의 durable 전달/outbox·retention과 [전체 조건부 범위](질의/조건부기술-전체구현.md)의 MQ·스케줄러·관측·오류 수집·Docker/Compose 실제 실행을 맡는다. 현재 파일 cleanup counter나 감사 commit 후 저장을 이 운영 보장의 완료로 해석하지 않는다.

010의 관련17개 초기15 PASS/2 FAIL은 [원래 로그](검증/010-e2e-final-related.log)에 남겼다. 동일 columns 배열의 in-place 이동에서 focus 복귀를 놓치던 공통 보드는 key 순서·beforeKey·pending focus identity를 검사하고 4개 단위 회귀와 최종 실제 Starter2개를 통과했다. trusted 이미지 drag/resize Escape는 390/1366px의4개 실제 assertion을 통과했으며 inline JSON attachment를 별도 보존된 해시 파일로 주장하지 않는다. 외부 패키지/생성기는011, crash 정리/복원·관측은012이며 음성/원격/Linux 검증도 남는다.

## 011 compiled 패키지·배포 세트·생성기의 책임

011은 **구현·로컬 검증을 완료**했다. 011 마감 당시 프런트 공통5개는 `0.2.0`, 공통 Maven은 `0.2.0-SNAPSHOT`이다. 앱 자체 버전·기존 API·DDL은 그대로 유지한다. [현재 pack](검증/011-package-artifacts-v02.json)은 npm5/Maven7, [손상 gate](검증/011-package-gates-v02.json)는25개·보호128파일 SHA 변경0을 통과했다. 최초0.1.0 세트와 초기 실패는 불변 보존한다.

| 실제 위치                                                                                   | 책임                                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 각 `frontend/packages/*/vite.library.config.mjs`, `tsconfig.build.json`                     | package-local ESM/선언 생산. UI strict source/skipLibCheck true, 나머지4 false                     |
| `scripts/build-library.mjs`, `library-config.mjs`, `library-artifacts.mjs`                  | bare vendor 외부화·AST 상대 선언 정규화·직접 원문 고지·완성 stamp/digest                           |
| `frontend/packages/ui/source-entries.json`                                                  | 공개 compiled exports와 대응하는8키. 공개 UI22개와 CSS/Sass 입력                                   |
| 각 package `dist`, `README.md`, `UNLICENSED`, `THIRD_PARTY_NOTICES`                         | tarball allowlist. UI `CONTRACTS.json` format2/22·단일 CSS·tokens 포함                             |
| `scripts/package-framework.mjs`, `verify-package-artifacts.mjs`, `verify-package-gates.mjs` | stamp/digest·실제 npm/Maven 세트·AST/hash·손상 gate. 소비 실행과 별도                              |
| `scripts/create-starter.mjs`, `verify-starter-generator.mjs`, `templates/starter-v1/`       | [최신48 경계](검증/011-generator-v02.json), template61·dry-run·새 target74파일·provenance          |
| `scripts/verify-package-consumer.mjs`, `verify-package-browser.mjs`                         | 레포 밖 tarball의 public 타입/native/Sass와 production UI·전체 DOM axe                             |
| `scripts/verify-generated-app.py`, `verify-generated-features.py`                           | 독립 생성 JAR·HTTP/H2 재기동·브라우저·런처/PID/선택 프로필9그룹                                    |
| `scripts/verify-package-upgrade.py`                                                         | 같은 생성 앱의0.1.0→0.2.0 전환·rollback, 소스/API/H2 보존                                          |
| Catalog `src/public-contract-arg-types.ts`, `.storybook/preview.ts`                         | compiled 컴포넌트의 docgen 누락을 생성 계약22개로 보완. Docs22/Controls10 실제 통과·초기 실패 보존 |
| `.github/workflows/verify.yml`의 `package-consumer`                                         | 별도 새 앱 cold build·타입/native/Sass·production 브라우저·생성 프로필9그룹. 원격 실행 미확인      |

[외부 타입](검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [cold build 세 번째](검증/011-consumer-build-third.log)의 실제 Notes 서버5개가 통과했다. 공통0.1.0을 설치한 [candidate4](검증/011-generated-fourth/summary.json)는 browser7/HTTP2·axe4 violations/중복ID0·PNG4를 확인했고 루트가 네 이미지를 직접 검토했다. [생성 프로필](검증/011-generated-features-second.json)은9그룹/선택6 PASS이며 최초 PID fixture 실패는 보존한다. 이것은 crash 복구 검증이 아니다.

[현재 fresh 통합](검증/011-server-and-artifacts-first.json)은 unit139/34 files·서버143, Reference35/Starter5 dist/JAR 바이트 일치다. 010의46/6 산출물 기록을 바꾸지 않는다. [현재 E2E](검증/011-e2e-first.log)는 main69+reports5=74 PASS, [axe](검증/011-e2e-axe-summary.json)는111회·violations/중복ID0·incomplete232/2117nodes다. [정상 시각4](검증/011-visual-final.json)는baseline17파일 변경0이다. 기능 [Story95](검증/011-stories-first.log)는 통과했지만 [compiled Docs 첫 실패](검증/011-storybook-browser-first.log)는 color 누락이다. Catalog adapter 작성·scoped 검사 후 Docs22는 실제 통과했으며 Controls0/10 첫 실패를 보존하고 정규화 수정 뒤 실제 재검증도 통과했다.

루트 lock은 하나다. Vue I18n/devtools-types11.1.12와 UI table-core9.2.6/virtual-core3.17.11을 직접 선언했다. UI vendor strict probe696개(Vuetify695/libDOM1)·자체0와 다른4 strictfalse0을 구분한다. [upgrade 첫 실패](검증/011-upgrade-first-failure.json)는 실제 빌드 성공 뒤 동적 API 서버 포트의 검증기 오인이다. 소스 변경0·정규화 API 동일을 확인했고 두 번째 전환/rollback은 통과했다. Windows·VoiceOver·Linux 시각/원격 CI·012 실제 운영은 미확인이다.

### 011 최종 로컬 확인과 당시012 준비 경계

[compiled Story95/28 files](검증/011-stories-controls-final.log)와 [정적 Docs22/Controls10](검증/011-storybook-browser.json)은 모두 실제 통과했고 브라우저 오류/API 누출은0이다. 첫 color 누락·Controls0/10 실패는 별도 로그/report에 보존한다. [0.2.0 외부 public 소비](검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [0.2.0 생성기48](검증/011-generator-v02.json)도 통과했다. UI vendor strict696/자체0·다른4 strictfalse0의 지원 경계는 유지한다.

[실제 upgrade/rollback 두 번째](검증/011-upgrade-rollback-second/summary.json)는0.1.0→0.2.0→0.1.0을 같은H2에서 통과했고 Notes revision1/2/3, 보호 업무 source47개 변경0·API 동일(`servers`만 정규화 제외)·공통JAR 정확한 바이트·기존lock 완전 복원을 확인했다. API·DDL이 같은 cohort의 전환 결과이며 파괴적 schema migration·사용자 코드 자동 병합을 지원한 결과가 아니다. 첫 build PASS/동적 server-port guard 실패 증거는 불변 보존한다.

[외부 optional OFF JAR](검증/011-generated-optionaloff/summary.json)는 HTTP2/browser4·선택chunk 요청0을 확인했다. [격리 내부 OFF](검증/011-starter-features.json)는 기본build 불변·요청0·선택chunk2개 emitted를 확인했으므로 완전한 번들 제거로 설명하지 않는다. [생성 프로필9/선택6](검증/011-generated-features-second.json)와 기본prod OFF도 통과했다.011은 구현·로컬 검증 완료다.012는 [CI 준비 정적 검사](검증/012-preparation-ci-check.json)의 YAML·Bash36·Python3 통과만 확인했고 remoteExecution/consumerExecuted/dependencyInstallExecuted는false다. 이 문단은 011 마감 당시의 준비 기록이다. 현재 012의 구현·실제 실행 범위는 아래 012 절에서 구분한다. 원격CI·Windows·Linux시각·VoiceOver/incomplete수동은 미확인으로 유지한다.

## 012 운영 모듈의 실제 파일과 책임

012는 구현·로컬 검증을 완료했다. 공통 5패키지 `0.3.0`/서버 `0.3.0-SNAPSHOT`과 앱 버전을 분리한다. 공통 UI 공개 22개·8진입점은 유지하고 운영 화면은 앱 `features/operations/`가 기존 Sc 입력·표·확인 대화상자를 조립한다.

| 위치                                                                                                                                                                                                                                                                      | 책임                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [runtime/browserErrors.ts](../frontend/packages/runtime/src/browserErrors.ts), [spec](../frontend/packages/runtime/src/browserErrors.spec.ts)                                                                                                                             | Vue/window/rejection hook·고정 코드 DTO·동일 Error 중복 억제·세션 generation·dispose. 업무/계정/Router import 없음 |
| Reference `features/operations/api.ts`, `capabilities.ts`                                                                                                                                                                                                                 | 앱 생성 DTO·기능별 Query key·단일 client·capabilities Query와 collector 수명                                       |
| Reference `MessagesPage.vue`, `SchedulesPage.vue`, `BrowserErrorsPage.vue`                                                                                                                                                                                                | 메시지 상태/DEAD 재시도·등록 작업/예약/이력·오류 집계/발생 이력. URL 선택·페이지·필터                              |
| Reference `ScheduleForm.vue`, `OperationsGate.vue`, `OperationsNavigation.vue`, `OperationsTable.vue`                                                                                                                                                                     | VeeValidate/Zod 입력·기준 revision·ADMIN/ON gate·실제 메뉴·ScDataTable 조립                                        |
| [Starter operations](../frontend/apps/starter-app/src/features/operations/)                                                                                                                                                                                               | 자체 API·capabilities와 중립 MessagesPanel/SchedulePanel/BrowserPanel. Reference import 없음                       |
| 두 앱 `main.ts`, `App.vue`, `localization.ts`                                                                                                                                                                                                                             | 3개 `/operations/*` route·앱 메뉴·ko/en·collector 설치. 기존 기본 OFF 탐색 유지                                    |
| [core messaging](../backend/framework-core/src/main/java/dev/scframework/core/messaging/), [scheduling](../backend/framework-core/src/main/java/dev/scframework/core/scheduling/), [operations](../backend/framework-core/src/main/java/dev/scframework/core/operations/) | 중립 메시지/handler·등록 작업·안전한 operational event SPI                                                         |
| autoconfigure `messaging/`, `scheduling/`, `browsererrors/`, `observability/`, `operations/`, `storage/`, `audit/`                                                                                                                                                        | outbox/inbox·Rabbit confirm/ACK·Quartz JDBC·오류 저장·allowlist 관측·runtime lock·journal·durable 감사             |
| [Reference operations](../backend/reference-app/src/main/java/dev/scframework/reference/operations/), [Starter operations](../backend/starter-app/src/main/java/dev/scframework/starter/operations/)                                                                      | 앱 actor/ADMIN 검사·등록 handler/PULSE·운영 DTO/controller·같은 DB/TX 소비                                         |
| Reference `db/operations-migration/V6__operations_messages.sql`, `V7__operations_scheduler_browser.sql`                                                                                                                                                                   | 앱 메시지·Quartz/browser DDL. 기존 V1~V5 checksum 유지                                                             |
| Starter `db/operations-migration/V2__operations_messages.sql`, `V3__operations_scheduler_browser.sql`                                                                                                                                                                     | 자체 audit V1과 선택 운영 DDL. 기본 profile schema와 분리                                                          |
| [templates/starter-v2](../templates/starter-v2/)                                                                                                                                                                                                                          | framework0.3용 Notes·선택 운영 소비. 자체 Notes V1/audit V2/messages V3/scheduler-browser V4                       |
| [compose.operations.yaml](../compose.operations.yaml), [infra/operations](../infra/operations/), [prepare-operations.py](../scripts/prepare-operations.py)                                                                                                                | exact image/digest·로컬 연결·새 private root/secret 준비. 기존 runtime 덮어쓰기 없음                               |
| [neutral-openapi-operations.py](../scripts/neutral-openapi-operations.py)                                                                                                                                                                                                 | 실제 Starter 명세의 운영+capabilities 13path와 참조 closure 19schema를 중립 runtime 명세에 반영·중복 ID 검사       |
| [verify-operational-boundaries.py](../scripts/verify-operational-boundaries.py), [verify-runtime-recovery.py](../scripts/verify-runtime-recovery.py), [verify-observability.py](../scripts/verify-observability.py)                                                       | 실제 JAR/H2·minute job·backup/crash/복원·지표/trace/log/Grafana 조회                                               |
| [backup-runtime.py](../scripts/backup-runtime.py), [restore-runtime.py](../scripts/restore-runtime.py)                                                                                                                                                                    | 정지한 같은 JAR/H2/uploads/journal 단일 세트·hash/Flyway 검사·새 빈 root 복원                                      |
| [playwright.operations.config.ts](../frontend/playwright.operations.config.ts), [012 운영 E2E](../frontend/e2e/012-operations.spec.ts), [OFF E2E](../frontend/e2e/012-operations-off.spec.ts)                                                                             | 분리된 운영 18193/18194·임시 H2/DEAD fixture·trace OFF. 기본 E2E는 운영 ON spec을 제외하고 OFF를 검사              |

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

[서버195](검증/012-backend-tests-fourth.log), [실제 운영18그룹](검증/012-operational-boundaries-first.json), [복구7그룹](검증/012-runtime-recovery-third.json), [관측7그룹](검증/012-observability-third.json)은 실제 통과했다. [collector/폼 단위10](검증/012-operations-focused-unit-final.log)·담당 타입/형식/lint도 통과했다. 새 프런트 포함 JAR·운영/OFF 브라우저·시각·pack/생성기 마감은 아직 통합 검증 중이다. [메시지·복구](질의/012-메시지와복구계약.md)와 [예약·오류](질의/012-예약과브라우저오류.md)의 계약을 함께 확인한다.

[운영 첫 브라우저10개](검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
