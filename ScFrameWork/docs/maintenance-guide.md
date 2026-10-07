# ScFramework 수정 위치

## 013 공통 디자인 규격을 사용할 때

[013 공통 디자인 프레임워크](질의/013-공통디자인프레임워크.md)의 공통 규격과 로컬 검증을 완료했다. 독립 소비 앱의 실제 브라우저도 확인했으며 사용자 수락은 미확인이다. 버튼 `size/intent/icon`, 입력 `density`, 선택 `presentation/tone`, 카드 `density/surface`, 표 `density/captionVisibility/minTableWidth`는 공개 prop으로 선택한다. 상태 문구는 [ScStatusBadge.vue](../frontend/packages/ui/src/patterns/ScStatusBadge.vue)의 `label/tone`으로 표시한다. 반복되는 색·padding·font를 공통 내부 `:deep`으로 덮어쓰거나 배지를 앱마다 복제하지 않는다. 업무 열 너비·콘텐츠 배치의 기능 소유 scoped 스타일은 유지할 수 있다.

공통 규격 변경은 `ui/src/contracts.ts`, `inputs/input-contracts.ts`, `patterns/contracts.ts`, `table/contracts.ts`와 해당 SFC에서 처리하고 공개 문서·metadata·Storybook·Reference/Starter/생성 템플릿을 함께 확인한다. 업무 숫자·권한·Router·Query·폼 schema는 기능 폴더에 유지한다. native 검색/file input·자체 그림·canvas는 책임에 맞으면 유지하며 반복되는 시각 규칙만 공통화한다.

아래 대시보드 교정의 로컬 완료 결과는 당시 검증이다. 013 전체 디자인 표준의 완료로 합산하지 않는다. 현재18082 실행 서버를 내리거나 기존 runtime을 테스트 자료로 사용하지 않고 별도 빌드·후보에서 확인한다.

## 이전 화면: 대시보드 디자인 교정 후보·사용자 수락 미확인

001~012의 기능 구현·로컬 검증 기록은 아래에 보존한다. 현재workspace와프리뷰는 Yzen정보계층을 참고한 **디자인 교정 후보**다. [교정의 새 근거](검증/design-correction-final-summary.json)는live40검사/wholeDOMaxe14회 위반0·통합unit155/선별서버10·새JAR관련30고유 케이스·정적파일46/8해시일치·Tailnet로그인/4KPI/SVG/pageerror0이다. 새JAR생성/재시작과직접접속도 확인했다. 새 시각 기준16PNG의 명시 갱신·정상 비교4개와 전체 Storybook105개/30files도 통과했다. 새패키지 독립 설치소비와 사용자 디자인 수락은 미확인이고 `accepted=false`다. 불변 `.runtime/releases/012`의0.3.0 기능아카이브와 현재source24공개UI/candidate를 구분한다. 과거unit149/서버196·Docs22를 새교정성적으로 표시하지 않는다.

전체 [Storybook105개/30files](../.runtime/design-correction/storybook-all-resize-final.log)와 새 [시각 비교4개](../.runtime/design-correction/visual-baseline-compare.log)가 통과했다. 이전104PASS/1FAIL과 새 기준의 명시 갱신·교정 전17파일 보존은 디자인 교정 문서에 기록했다. 자동 로컬 검증 완료와 사용자 디자인 수락은 구분한다.

Reference의 로그인 후 기본 화면·`/`·미등록 URL fallback은 인증이 필요한 `/dashboard`다. 기존 `/examples` CRUD는 별도 메뉴로 유지한다. 로그인은 셸 없이 분할 화면으로 표시하며 로그인 상태·busy/error·성공 시 비밀번호 초기화 계약을 유지한다. 새 대시보드는 **샘플 매출**과 **실제 업무 현황**을 화면에 명시하여 구분한다. 매출 수치는 자체 예제 자료이고 실제 조회는 기존 권한 적용 보고서 API·Vue Query를 재사용한다. 새 업무 API endpoint는 추가하지 않는다.

## 대시보드와 디자인 후보를 수정할 때

[DashboardPage.vue](../frontend/apps/reference-app/src/features/dashboard/DashboardPage.vue)의 화면 선택은 Router `source`/`period`가 원본이다. 기본 샘플의 기간 변경은 예제 매출 자료를 바꾸고, `source=live`에서만 [기존 보고서 Query](../frontend/apps/reference-app/src/features/reports/requirements/query.ts)를 활성화한다. 실제 KPI와 상태 집계는 현재 사용자에게 공개된 전체 결과이며 수정일 분포는 최근20건이라는 범위를 화면에서 명시한다. 서버 조회를 Pinia에 복사하거나 예제 매출을 운영 집계로 저장하지 않는다.

KPI는 [ScKpiCard](../frontend/packages/ui/src/patterns/ScKpiCard.vue), 다중 series는 [ScSeriesChart](../frontend/packages/ui/src/charts/ScSeriesChart.vue)에 표시 자료를 전달한다. 앱은 조회/권한/라우트를, 공통 UI는 props 표시와 명시적 이벤트를 소유한다. SFC template 중심·읽기 전용 props·토큰 기반 CSS를 유지한다.

[셸 types](../frontend/packages/ui/src/layout/types.ts)의 선택적 `iconPath`는 24×24 장식 SVG path이며 메뉴 accessible name은 기존 `label`이다. `groupLabel`은 앱에서 번역한 연속 그룹 제목이다. `header-leading` slot은 검색 등 앱 행동을 조립하고, 접기/펼치기 문구는 선택적 labels로 번역한다. [셸](../frontend/packages/ui/src/layout/ScAppShell.vue)의 href/modified click·aria-current·단일 main/skiplink·native dialog/Tab/Escape·포커스·ResizeObserver 해제와 [미저장 guard](../frontend/apps/reference-app/src/shared/useDraftGuard.ts)를 보존한다.

[App.vue](../frontend/apps/reference-app/src/App.vue)의 메뉴 검색은 현재 권한/capabilities로 만든 메뉴에서만 찾고 실제 Router로 이동한다. identity 아바타는 현재 사용자 이름에서 만들며 native popover에 실제 내 계정/로그아웃을 둔다. 언어 변경은 기존 i18n/Vuetify에 연결한다. [LoginPage.vue](../frontend/apps/reference-app/src/features/auth/LoginPage.vue)는 로그인 전 셸을 표시하지 않으며 한국어 아이디·비밀번호·로그인 접근성 이름과 auth/busy/error/password-clear를 유지한다. 신규 route 변경은 [main.ts](../frontend/apps/reference-app/src/main.ts), collector의 고정 allowlist와 서버 SPA forward를 함께 확인한다.

현재 프리뷰는 새 source 후보이고 `@sc/ui`는 compiled dist를 소비한다. 공통 UI source 수정 후 library/app 빌드를 통해 화면에 반영해야 한다. 새 JAR관련30고유 케이스·정적파일46/8해시·전체 Storybook105개와 새 시각 기준16PNG/정상 비교4개를 확인했다. 과거 시각 baseline을 새 화면 승인으로 사용하지 않는다.

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

## 010 업무 확장 수정 위치

[010 단계](질의/010-업무확장과파일작업실.md)는 진행 상태와 실제 검증을 기록한다. UI board/image는 센서·이동 emit·원본0~1 좌표·zoom·노드 정리를 맡고 Reference 기능은 API/권한/상태/CAS를 맡는다.

RequirementWorkspace의 본문·검토·지정·박스·첨부·ADO는 각각 입력 기준 revision을 유지한다. Query 재조회는 dirty 입력을 덮어쓰지 않는다. 저장 성공은 해당 채널을 reset하고 다른 clean 채널의 기준도 최신 응답에 맞추며, 다른 dirty 채널의 입력·기준 revision은 보존한다. 본문 저장도 기존 이미지 버전/박스를 보존한다. shared/useDraftGuard.ts는 Router 이탈 확인을 제공하며 기존 requirements 경로는 호환 re-export다. 이전 세션/선택의 응답은 현재 입력에 반영하지 않는다.

공지 content는 평문이고 documents JSON만 허용 schema를 통과해 Tiptap에 전달한다. 링크의 지원 문법과 공유 golden vectors를 검증하며 전체 WHATWG URL 표준 동등성을 주장하지 않는다. Excel 달력 날짜0000/0099·태그 안 쉼표·물리 행 번호를 보존한다. tags 열은 JSON 문자열, sourceRowNumbers는 유효 행과 병렬이다.

파일 요청도 단일 runtime client를 사용한다. Blob/ArrayBuffer 오류는 bounded decode 후 ApiError.fields/401/CSRF를 처리한다. Object URL/Image decode/Observer/다운로드 AbortController/timer는 소유 컴포넌트가 해제한다. write 뒤 input.close 실패도 새 blob을 정리한다. DB rollback은 새 blob 삭제, 기존 blob 삭제는 commit 뒤다.

화면 변경 후 fresh 프런트 포함 JAR와010 E2E·기존 요구사항/보고서·Storybook/axe/시각 회귀를 실행한다. 010은 [최종 fresh 통합](검증/010-integration-build-focus-final.log)의 unit139/34 files·서버143개와 [최종 요약](검증/010-final-summary.json)의 main69+reports5=74 E2E·axe111회 violations/중복ID0·Story95/28 files·공개 Docs22/Controls10·정상 시각4 PASS를 확인하여 로컬 완료했다. 다른 단계의 역사적 성적과 외부 소비/운영 검증은 이 결과에 합산하지 않는다.

| 변경하려는 것                                  | 수정 위치                                                                                                                                          | 검증                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 디자인 값·공통 테마                            | frontend/packages/ui/src/tokens.ts, theme.ts                                                                                                       | 토큰 생성·일치 검사·대비·Storybook·두 앱 빌드                      |
| 버튼·입력·공통 스타일                          | frontend/packages/ui/src/Sc*.vue, styles.scss                                                                                                      | UI 계약·Storybook·두 앱 빌드                                       |
| header/sidebar/모바일 탐색                     | frontend/packages/ui/src/layout                                                                                                                    | skiplink·current route 표시·Tab/Escape·focus·반응형                |
| Reference 메뉴·세션 동작                       | frontend/apps/reference-app/src/App.vue                                                                                                            | 세션·route guard·로그아웃·업무 E2E                                 |
| Starter 메뉴·현재 화면                         | frontend/apps/starter-app/src/App.vue                                                                                                              | 독립 소비·자체 route·최소 앱 기동                                  |
| HTTP·CSRF·세션·공통 오류                       | frontend/packages/runtime/src                                                                                                                      | runtime unit·서버/JAR·세션 E2E                                     |
| 날짜·UTC 원문·달력·시간대 표시                 | frontend/packages/date/src, 각 앱 날짜 소비 위치                                                                                                   | raw/윤년/소수초·ko/en/zone·경계값·Story/JAR 표시                   |
| 앱 사용자·요구사항·권한/revision               | backend/reference-app/src/main/java/dev/scframework/reference                                                                                      | 현재 DB actor·가시성·실제 concurrent flush·rollback·업무 E2E       |
| 보안 감사 SPI·설정·기록                        | backend/framework-core/src/main/java/dev/scframework/core/audit, backend/framework-autoconfigure/src/main/java/dev/scframework/autoconfigure/audit | backoff·commit/rollback·H2·민감값 제외·sink 실패의 HTTP 보존       |
| 레퍼런스 업무 화면·입력 schema                 | frontend/apps/reference-app/src/features                                                                                                           | 폼·API 계약·업무 E2E                                               |
| Starter 초기 화면                              | frontend/apps/starter-app/src                                                                                                                      | 최소 소비 앱 빌드·기동                                             |
| 공통 UI 사용 문서·상태                         | frontend/apps/catalog                                                                                                                              | Storybook build/interaction/a11y                                   |
| 공통 UI 공개 타입·props/events/slots/속성 경계 | frontend/packages/ui/src, docs/질의/UI-공개계약.md                                                                                                 | 소비 앱 타입·public export·UI 동작·Storybook/JAR 검증              |
| 추가 입력·폼 행동·확인 dialog                  | frontend/packages/ui/src/inputs, forms                                                                                                             | native form·readonly/disabled·오류 ID·Tab/Escape·focus 복귀        |
| 페이지·검색·카드·상태·목록/상세                | frontend/packages/ui/src/patterns                                                                                                                  | props/events/slots·검색/reset·loading/empty/error·모바일 입력 보존 |
| 표·선택·페이지·가상화                          | frontend/packages/ui/src/table, 각 앱 features/patterns/TablePatterns.vue                                                                          | 안정적 키·client/server 처리·10,000행 실제 스크롤·focus·DOM 제한   |
| 차트·JSON 에디터                               | frontend/packages/ui/src/charts, editor                                                                                                            | 자체 계약·토큰/대체 표·resize/dispose·schema/link·readonly/destroy |
| XLSX 변환·파일 UI                              | frontend/packages/excel/src, 각 앱 features/patterns/ExtensionPatterns.vue                                                                         | 실제 파일 재읽기/다운로드·제한/오류·staging/승인·URL/작업 수명     |
| 다국어 공통 문구·locale 연결                   | frontend/packages/i18n/src, 각 앱 localization.ts/App.vue                                                                                          | ko/en·fallback·앱 격리·Vuetify/document.lang·입력/선택 보존        |
| 서버 공통 설정                                 | backend/framework-autoconfigure                                                                                                                    | 소비 앱 override·Security·오류 테스트                              |
| JPA/Mapper/Feign 업무                          | backend/reference-app                                                                                                                              | H2·revision·flush/rollback·mock                                    |
| 최소 서버 도입 설정                            | backend/starter-app                                                                                                                                | reference 업무 없이 기동·API smoke                                 |
| 실행·빌드·검증                                 | scripts, .github/workflows                                                                                                                         | 실제 명령·cleanup·CI 실행 여부                                     |

Vue 파일은 template부터 읽는다. 업무 폼·조회·권한을 공통 UI에 합치지 않는다. API 성공 JSON과 세션·CSRF·필드 오류를 보존하며 DB와 외부 HTTP의 트랜잭션 경계를 구분한다. 전체 개발 규칙은 [AGENTS.md](../AGENTS.md)에 있다.

## 디자인 값을 바꿀 때

`frontend/packages/ui/src/tokens.ts`의 `uiTokens`만 수정한다. `theme.ts`와 디자인 Storybook은 이 객체를 직접 읽으며 `tokens.scss`는 생성기로 갱신한다. 생성된 값을 수동 수정하면 다음 일치 검사에서 실패한다.

```bash
npm run tokens:generate --workspace @sc/ui
npm run tokens:check --workspace @sc/ui
npm run typecheck
```

UI workspace의 `typecheck`도 `tokens:check`를 먼저 실행한다. 이후 프로젝트의 format/lint/unit/build·관련 Storybook·브라우저 검증을 수행한다. 002 전체 실행 결과와 초기 실패·수정은 [002 기록](질의/002-디자인토큰.md)에 확정했다.

`@sc/ui/tokens`는 공개 Sass 진입점이다. 소비 앱은 `packages/ui/src` 상대 경로에 결합하지 않는다. UI 패키지 내부만 로컬 Sass 경로를 사용한다.

일반 SCSS에서는 `var(--sc-space-4)`처럼 CSS 변수를 사용한다. media query에는 CSS 변수를 쓸 수 없으므로 생성된 Sass breakpoint를 사용한다. scoped SFC에서 breakpoint만 읽을 때는 CSS 원본의 중복 방출을 막는다.

```scss
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);

@media (max-width: tokens.$sc-breakpoint-sm - 1px) {
  // 해당 컴포넌트의 좁은 화면 배치
}
```

공통 기준은 본문 14px·제목 24px, 버튼/입력 반경 6px·카드 8px·대화상자 정책 12px, 본문 최대 폭 1280px다. breakpoint는 768/1200/1600/1920px다. 셸의 전체 높이 모바일 drawer는 직각이며 005의 일반 ScConfirmDialog는 공통 12px 대화상자 반경을 적용한다. 자세한 값과 적용 여부는 [디자인 문서](질의/디자인.md)에 둔다.

## 셸과 앱의 경계

`ScAppShell`의 `applicationTitle`·`applicationLabel`·`navigationLabel`·`navigationItems`·`activeItem`을 앱에서 전달한다. `navigationItems`의 항목은 `{id,label,href}`이며 `activeItem`은 Router의 현재 route에서 계산한다. 별도의 현재 화면 상태를 만들지 않는다. 일반 링크 선택의 `navigate` 이벤트는 소비 앱의 Router에 연결한다. Ctrl/Meta 등 새 탭 선택은 브라우저 기본 동작을 유지한다.

`default` slot은 업무 화면, `header-actions`는 계정/앱 행동, `notice`는 앱 전체 알림, `sidebar-footer`는 데스크톱 탐색 아래 설명을 받는다. Reference App은 로그인 전 로그인 메뉴, 로그인 후 예제 메뉴와 로그아웃을 구성한다. Starter는 자체 시작/공통 예제 route를 주입하며 /patterns는 독립 features를 lazy load한다. 메뉴가 안 보이는 것을 서버 권한 검사로 취급하지 않는다.

셸의 `main`은 하나다. 페이지 root는 `section`을 사용하고 페이지의 `h1`과 필요한 `aria-labelledby`를 둔다. `v-app`·`main`을 페이지에서 다시 감싸지 않는다. 모바일 탐색은 native `dialog`로 열고 닫으며 키보드·배경 접근 제한·focus 복귀를 확인한다. 셸마다 고유 ID를 가진 `본문으로 이동` 링크는 `tabindex="-1"` 본문에 focus를 보낸다.

헤더 토큰 64px는 최소 높이다. 긴 앱 제목 등으로 실제 높이가 커지면 셸의 `ResizeObserver`가 내부 `--sc-shell-header-height`를 갱신하고 sidebar sticky 위치·높이를 맞춘다. 이 측정 상태를 Pinia나 토큰 원본에 복사하지 않는다. Observer·media query listener는 해당 셸이 해제한다. 모바일 Escape는 명시적인 keydown으로 닫고 native dialog의 focus 복귀를 유지한다. 열려 있는 모바일 탐색을 넓은 화면으로 전환하면 현재 desktop 링크로, 그 링크에 focus가 있는 채 좁은 화면으로 돌아오면 메뉴 열기 버튼으로 이동한다.

공통 SFC는 `<template>` → `<script setup lang="ts">` → `<style scoped lang="scss">` 순서로 읽는다. 신규 공통 UI의 파일/import는 `Sc...`, template tag는 `sc-...`, CSS는 `.sc-*`다. props는 camelCase, template 속성은 kebab-case, 공개 이벤트와 named slot은 단일 단어 또는 kebab-case를 사용한다. 업무 페이지·API·schema·composable에는 접두사를 자동으로 붙이지 않는다.

## 공통 UI를 사용하거나 계약을 바꿀 때

버튼·입력·셸의 실제 props·기본값·event·slot·허용 HTML/ARIA/data 속성과 사용 SFC는 [UI 공개 계약](질의/UI-공개계약.md)을 먼저 읽는다. 003의 공개 계약 구현·로컬 검증은 완료했으며 실행 결과와 초기 실패는 [003 기록](질의/003-공통UI계약.md)에 남긴다.

업무 폼은 VeeValidate의 입력·오류 또는 해당 폼의 로컬 입력을 원본으로 사용한다. 문자열은 `ScTextField`의 `v-model`로 전달하고 Zod safeParse/서버 field 오류를 `error-messages`에 연결한다. 입력·선택·busy의 상태를 공통 UI 안이나 Pinia에 다시 복제하지 않는다. readonly는 읽기 가능·focus 유지, disabled는 사용 불가라는 입력 계약으로 구분한다. UI에서 입력이나 버튼을 막는 것으로 서버 권한 검사를 대체하지 않는다.

버튼은 기본 `type="button"`이다. form 제출을 맡을 때만 앱에서 `type="submit"`을 명시하고 form의 submit handler에 저장 동작을 둔다. busy/disabled에서 동작이 실행되지 않는지 확인한다. 버튼 내부에 별도 저장 API·Query 무효화·revision 규칙을 넣지 않는다.

공개 타입·SFC·index exports·Storybook controls/사용 예제·두 소비 앱·계약 문서를 함께 변경한다. Vue/Vuetify attrs를 무조건 전달해서 common UI 계약을 우회하지 않는다. 필요한 새 HTML 속성이나 공개 prop은 실제 form/ARIA 사용처와 전달 DOM 위치를 확인한 뒤 추가한다. token·export·prop/event/slot 이름을 폐기할 때는 대체 사용법·이유·제거 버전·changelog를 남긴다. 안정판과 현재 0.x의 변경 기준은 [변경·폐기 정책](질의/UI-공개계약.md#변경폐기-정책)을 따른다.

공통 패키지는 앱을 import하지 않는다. 메뉴/URL은 앱 Router, 서버 자료는 업무 Vue Query, 저장 전 입력은 폼, 세션·CSRF·단일 HTTP client는 runtime이 소유한다. `ScAppShell`은 `navigate`를 내보내고 실제 route 이동/미저장 가드는 앱이 연결한다. 공개 계약의 검증과 외부 npm 패키지·Starter 생성 검증은 구분하며 011 완료로 앞당겨 표시하지 않는다.

## 카탈로그와 자동 계약 문서를 바꿀 때

[004 Storybook 운영 계약](질의/004-Storybook.md)에 실제 설정·SFC 예제·검증 범위가 있다. 공개 타입 변경은 `npm run ui:contracts:generate`로 추출하고 변경 내용을 검토한 뒤 snapshot을 갱신한다. `npm run ui:contracts:check`와 `npm run ui:boundaries:check`는 root verify의 계약 검사다. 수동으로 Docs의 props 표를 작성하여 실제 타입과 분리하지 않는다.

Catalog `main.ts`는 프로젝트 루트를 기준으로 `frontend/apps/catalog/tsconfig.docgen.json`을 읽는다. UI source include와 Vue 컴파일러가 metadata 추출보다 먼저 실행되는 plugin 순서는 로컬 SFC fixture 문서 추출에 적용된다. compiled 공개 컴포넌트에는 `__docgenInfo`가 없어011 첫 Docs에서 color가 누락됐다. 현재 `src/public-contract-arg-types.ts`가 생성된 `docs/ui-contracts.json` format2 계약을22개 title에 연결한다. 공개 compiled import와 실제 args·CSF fixture를 유지하며 타입·required·명시 기본값·이벤트·slot을 표시한다. 동명 prop/slot은 별도 행으로 유지하고 함수·HTMLImageElement·이벤트·slot은 Controls로 편집하지 않는다. 실제 Docs22/Controls10 재검증은 통과했으며 source 검사와 구분한다. `preview.ts`의 유니코드 기본값 해독은 문서 표시만 바꾸며 events/slots/exposed의 `control: {disable:true}`는 잘못된 prop 입력을 막는다. 실제 계약 값을 바꾸는 기능으로 사용하지 않는다.

문자열 입력 fixture는 로컬 draft를 즉시 갱신하고 native change에서 Controls args에 commit한다. 이 fixture 연결 때문에 업무 UI의 즉시 `update:modelValue` 계약을 변경하지 않는다. 브라우저 검증기는 Default play가 끝난 뒤 manager Controls를 조작한다. 입력 중 manager 탭을 누르면 iframe focus가 이동하여 검증 자체가 입력을 중단할 수 있다.

MSW 초기 handler는 `/api`·`/api/*`를 `HttpResponse.error()`로 차단하고 정상/오류 story handler가 앞에서 응답한다. 정적 자산은 bypass한다. story마다 reset해도 초기 차단 handler는 유지한다. 실제 앱의 세션·CSRF·runtime client를 Catalog에 연결하지 않는다. `npm run build-storybook`·`npm run test:stories` 이후 `node scripts/verify-storybook.mjs`로 Docs와 Controls, 미정의 API의 네트워크 차단/누출 0을 따로 확인한다.

## 005의 실제 소비 화면을 바꿀 때

현재 [005 입력·폼](질의/005-입력폼계약.md)·[표·가상화](질의/005-표가상화계약.md)·[확장 모듈](질의/005-확장모듈계약.md)의 실제 props/defaults/events/slots를 사용한다. main `@sc/ui`는 입력/폼/7 patterns를, `@sc/ui/table/charts/editor`는 해당 모듈의 자체 계약을 제공한다. 이름만 다른 wrapper나 library 전체 options를 추가하지 않는다.

두 앱의 `/patterns`는 각자의 `features/patterns/PatternsPage.vue`를 lazy load한다. PatternForm의 업무 입력/오류/dirty는 VeeValidate 문맥 하나, Zod safeParse는 해당 폼 규칙이다. API 저장이 필요한 수정은 Reference Examples의 API/Query·서버 계약에 연결한다. local 검증 성공 문구를 서버 저장 완료로 바꾸지 않는다.

TablePatterns의 row ID·정렬·페이지·선택은 앱이 원본이다. Reference Examples는 기존 page/size API를 `data-mode="server"`로 소비하므로 현재 page의 client 정렬을 전체 서버 정렬처럼 표시하지 않는다. 실제 새 서버 검색/정렬은 OpenAPI·서버 count/허용 필드·API 타입·테스트와 함께 별도 구현한다.

ExtensionPatterns는 XLSX header를 `Name/Quantity/UTC/Note`와 시트 `Examples`로 고정한다. 화면 문구와 다른 canonical 계약이므로 locale를 바꾸어도 같은 파일을 읽는다. 새 파일은 staging만 만들고 오류가 없을 때 명시적으로 현재 예제 자료에 반영한다. 취소·실패·이전 비동기 응답이 현재 자료를 바꾸지 않는지 확인하고 unmount에서 Object URL/타이머/작업을 정리한다. 실제 업무 파일 저장·권한·DB 반영은 010이 맡는다.

중립 UI의 disabled/readonly·loading·오류 표시와 앱의 권한·dirty·revision 판단은 분리한다. 폼 재조회 실패·늦은 이전 응답·세션 교체의 입력 보존은 MSW와 두 앱/JAR에서 실제 확인하고 해당 [005 통합 기록](질의/005-공통입력과화면패턴.md)에 남긴다. 005는 81 Story·20 공개 UI Docs/8 Controls·18 새 JAR E2E·84 unit·15 서버 검사를 최종 통과했다. 초기 14/18→3/18 E2E 실패와 원인/수정 기록을 보존한다.

## 다국어와 후속 작업

002의 제목·메뉴·slot 주입 경계를 바탕으로 005에서 @sc/i18n의 독립 factory·ko/en 공통 메시지·fallback·누락 키 진단을 구현했다. 앱별 localization.ts와 App.vue가 업무 메시지·locale 선택·셸 labels·Vuetify current·document.lang을 소유한다. Catalog preview의 toolbar globals와 ScStoryLocale도 Vue I18n/Vuetify/wrapper lang에 연결한다. 두 앱/JAR와 전체 카탈로그 검증은 [005 기록](질의/005-공통입력과화면패턴.md)에 확정한다. [조건부 기술 전체 구현 기준](질의/조건부기술-전체구현.md)에 따라 이후 구현 대상도 유지한다. Redis·JWT·SSO 제외는 바뀌지 않는다.

## 선택 활성과 계약 회귀를 바꿀 때

Starter의 `frontend/apps/starter-app/src/config.ts`는 `VITE_SC_PATTERNS_ENABLED` 문자열이 정확히 false인 빌드에서 패턴 기능을 비활성화한다. `main.ts`의 lazy route와 `App.vue` 메뉴가 같은 값을 사용한다. `scripts/verify-starter-features.mjs`로 격리한 비활성 빌드/브라우저를 검사한다. 현재 정상 시작·/patterns→/ 복귀·optional chunk 요청 0을 확인했지만 JS/CSS 두 산출물이 남는다. 완전한 번들 제거와 설치 비용은 외부 production 동작과 구분한다.011의 생성 앱 기본 prod OFF/선택 프로필 검증은9그룹·선택6개를 통과했으며 기존 내부 Starter의005 emitted2개 기록은 유지한다. 생성기 경계와 외부 타입 검사의 현재 실제 결과는 아래와 구분한다.

`docs/ui-contracts.json`의 format 2는 prop.defaultSpecified=false(미기재)와 true+default:null(명시 null)을 구분한다. ScSelect.modelValue와 ScDataTable.sorting이 실제 예다. generic metadata의 object/unknown 특수화를 전체 공개 타입의 손실로 단정하지 말고 자체 타입·배열·vendor 비노출·실제 Docs를 함께 확인한다.

경계 checker는 실제 workspace manifest exports를 사용한다. 소비 앱/다른 shared는 공개 이름으로 import하며 같은 패키지 내부 상대/alias 경로는 허용한다. 원본 대신 임시 project는 `node scripts/check-ui-boundaries.mjs --root <임시경로>`, 임시 계약은 `node scripts/ui-contracts.mjs --check --snapshot <임시JSON>`으로 검사한다. `npm run test:framework-gates`의 006 최종 실제 24 case는 private·app→app·shared→app·다른 shared private·default drift를 차단하고 보호 입력 169개 변경 0/cleanup을 확인했다. 이 결과를 005의 578 imports/20 계약이나 004 역사 성적에 소급 합산하지 않는다. 계산형 import/CJS/Sass @import/복수 Vue script/tsconfig alias 전체 해석은 별도 범위다.

Reference에서 최신 조회 오류가 나면 dirty 입력/revision을 보존하고 다시 조회한다. 선택 A→B 뒤 A의 늦은 저장 성공/409가 B 입력을 바꾸지 않도록 선택 ID/세션 요청 소유권을 유지한다. PatternForm의 이동 확인은 세션 identity가 있는 경우에만 적용하여 로그아웃이 미저장 Promise에 갇히지 않게 한다. 새 JAR E2E로 확인한 이 동작을 공통 UI 내부로 옮기지 않는다. `/patterns` 직접 HTML 접속은 Spring SPA mapping이 맡고 기존 API/Swagger JSON을 변경하지 않는다.

[006 기능·접근성·시각 회귀](질의/006-기능접근성시각회귀.md)는 구현·로컬 통합 검증을 완료했다. 007 업무 파일럿은 구현·로컬 통합 검증을 완료했으며 008 조회·매핑·외부 연동도 구현·로컬 통합 검증을 완료했고009도 구현·로컬 통합 검증을 완료했으며 010은 구현·로컬 통합 검증을 완료했다. 011 compiled/pack/외부 타입·생성기 경계는 아래처럼 실제 확인했고 외부0.1.0 생성 앱 JAR/브라우저는 통과했고0.2.0 upgrade/0.1.0 rollback까지 통과했다. 011 마감 당시012 운영·Compose는 미검증이었고 Docker daemon만 사전 확인했다. 현재012 실행은 아래 절을 따르며 원격CI는 미확인이다. [007 요구사항 조사](질의/007-요구사항계약조사.md)는 구현 입력 자료이며 실제 구현과 실행은007 파일럿 기록에서 확인한다.

## 실제 앱 접근성과 시각 기준을 바꿀 때

`frontend/e2e/accessibility.spec.ts`는 루트 검사 전용 axe-core를 실제 JAR 전체 문서에 주입한다. 정상/오류/열린 dialog·select·mobile menu 상태별 `violations`, `incomplete`, 중복 ID를 함께 보존한다. 006의 최종 26 JAR E2E에는 8개 접근성 흐름·40회 scan이 포함된다. rule 비활성화나 DOM 제외로 통과시키지 않는다. 정상 Story와 별도로 `npm run test:a11y-gate`가 실제 이름 없는 버튼의 내부 exit1/skip0을 확인한다.

목록의 스크롤 region 이름은 `ScTableLabels.listScrollRegion(label)`로 locale에 맞게 주입한다. 기본 `${label} 스크롤 영역`과 영어 `${label} scroll area`는 목록 제목과 구분한다. native summary의 marker·최소32px 높이/44px 폭, 차트 legend/축 간격도 화면 검수 대상이다.

시각 비교는 새 두 JAR를 만든 뒤 기존 JAR E2E와 순차 실행한다. `SC_VISUAL=1`·동일 OS/CPU/browser/font·`--update-snapshots=none`을 사용하고 4개 case/16 PNG를 확인한다. scroll0의 document bounding box와 page fullPage/clip으로 카드를 캡처하며 sticky header CSS를 검사 편의로 바꾸지 않는다. 생성에는 명시 `SC_VISUAL_UPDATE=1`·새 run ID·로컬 update all이 필요하고 CI에서는 금지한다. 변경 이유·새 이미지·환경 manifest를 함께 검토한다. 006의 검토 보존본을 후속 갱신으로 덮어쓰지 않는다.

수동 `.github/workflows/visual.yml`은 같은 repo의 Linux immutable artifact·run ID·manifest SHA-256을 받아 비교만 한다. 커널/OS 변경도 fail이므로 승인 환경부터 맞춘다. Mac baseline을 Linux에 사용하지 않는다. 기본 CI와 시각 CI를 구분하며 원격 미실행·VoiceOver 실제 음성 미확인·axe incomplete를 완료로 처리하지 않는다. 구체적 명령·초기 실패·검토·갱신·evidence 정책은 [006](질의/006-기능접근성시각회귀.md)에 있다.

## 007 요구사항·사용자·날짜·감사를 바꿀 때

007의 구현·로컬 통합 검증을 완료했다. [파일럿 기록](질의/007-요구사항파일럿.md)·[API 계약](api.md)·[운영 계약](operations.md)의 상태와 실제 실행 결과를 함께 읽는다. fresh 통합 서버52·unit108/23 files·8 workspace+E2E/helper 타입·새 두 JAR와 업무 포함 E2E41·fullDOM axe52회·Story83/26 files·Docs20/Controls8을 통과했다. 실제 런처/HTTP·metadata·모바일 목록 수정 후 새 JAR/axe·6장 업무 이미지 검토도 통과했다. npm run typecheck:e2e는 frontend/tsconfig.e2e.json을 사용하며 global typecheck 끝에서도 실행한다.

Reference의 사용자 응답 변경은 backend identity의 UserDtos/UserController와 앱 auth/identity.ts·생성 api.d.ts에 연결한다. 기본 Starter의 username/roles나 legacy neutral 타입을 Reference의 numeric ID/role에 맞추어 바꾸지 않는다. 공통 runtime의 decodeIdentity 확장을 사용하며 앱에 별도 HTTP client·me 요청·사용자 복사 상태를 만들지 않는다. `sc.framework.session-endpoint.enabled=false`는 Reference의 기본 me만 끄고 로그인/CSRF를 유지한다.

요구사항 변경은 Reference 서버 requirements의 DTO/Service/JPA·history와 프런트 features/requirements의 API/query/schema/permissions/폼을 함께 확인한다. 본문과 검토의 baseline revision/resetKey를 분리하고, 오류·재조회·늦은 A 응답·선택 B·세션 전환에서 작성 중 입력을 보존한다. 댓글 성공으로 본문을 초기화하지 않는다. 미저장 이동·재조회·상태 전이 확인은 앱이 맡는다. 현재 DB actor/role과 원본 상태/revision 검사 순서를 서버에서 유지하며 ADMIN 권한을 타인의 본문 수정 권한으로 확대하지 않는다. 새 상태 명령에는 실제 같은 시각 revision 증가·동시 flush·rollback/history·권한·JAR 검증을 연결한다.

날짜는 공개 @sc/date의 isCalendarDate/parseUtcTimestamp/createDateFormatter를 사용한다. calendar 날짜는 시간대로 이동하지 않고 서버 timestamp raw는 다시 저장용으로 직렬화하지 않는다. 표시에만 locale/zone을 적용한다. ISO UTC 소수초 raw 1~9자리와 H2/서버 마이크로초 정밀도를 구분한다. Day.js 단독 처리에서 확인한 0..99년/역사적 초 단위 offset 문제는 wrapper의 실제 날짜/Intl 경계 처리로 검증하며 vendor 객체를 공통 공개 타입에 추가하지 않는다. 날짜 입력 검증 규칙·업무 선택 zone은 앱이 소유한다.

보안 감사는 core SecurityAuditEvent/SecurityAuditPublisher/SecurityAuditSink 계약과 autoconfigure adapter에 둔다. 업무 성공 이벤트는 transaction 안에서 publish하여 commit 뒤에만 기록하며, rollback된 성공을 남기지 않는다. 업무 history snapshot 대신 감사를 사용하지 않는다. 새 action/resource/reason은 bounded code 정책을 따르고 본문·password/hash·cookie/session/token·SQL·예외 message를 추가하지 않는다. sink 실패의 고정 warning/counter와 committed HTTP 유지도 검사한다. durable delivery/outbox·retention·관측은 012 범위로 남긴다.

Reference 감사 조회는 앱 AuditController/현재 DB ActorResolver·V3를 변경한다. nullable metadata도 JSON key를 유지하고 required/null/outcome/bounds를 실제 `/v3/api-docs` assertion 및 생성 타입과 함께 검사한다. 기본 Starter는 감사 비활성이다. 선택 audit profile과 자체 migration은 Reference source 없이 소비하며 run.sh의 Starter 전용 안전 profile allowlist·기동/재기동/Swagger/H2는 [실제8개 그룹](검증/007-starter-audit-launcher.log)을 통과했다. 기본 schema 없음과 선택 자체 V1/9개 이벤트 재기동 보존을 구분한다.

명세 변경은 Reference·Starter live snapshot 두 개와 legacy neutral compatibility 생성 산출물을 구분한다. `npm run api:generate`·`api:check`·`api:check-server`와 실제 HTTP/schema 검증을 수행하고, 새 Vue 빌드를 포함한 두 JAR로 requirements E2E·기존 006 접근성/시각 회귀를 실행한다. 원본 WorkboardVue DB·실행 자료·비밀번호를 가져오지 않고 임시 합성 자료를 사용한다. 실패한 검사·변경 이유·남은 범위를 지우지 않는다.

007의 생성 시각 manifest는 Prettier 재작성으로 승인 바이트를 바꾸지 않는다. .prettierignore의 visual.spec.ts-snapshots/*/manifest.json만 제외하며 npm run visual:manifest:check가 일반 verify/CI에서 schema와 macOS16PNG 해시를 필수 검사한다. 실제 pixel 비교는 동일 환경에서 별도로 실행한다. 최신 [007 모바일 fresh 통합](검증/007-integration-build-mobile-second.log)과 [41개 JAR E2E](검증/007-e2e-mobile-final.log)를 확인했으며 axe52회의 incomplete rule instances99·수동 음성 검증은 미확인으로 남긴다.

## 008 조회·매핑·외부 HTTP를 바꿀 때

[008](질의/008-조회매핑과외부연동.md)은 필수 fresh 통합과 서버77/unit108·부모 상속 fixture2/실패 gate·새 JAR E2E41/전체 DOM axe52·live2/타입3·HTTP17·원본170개 변경0을 통과하여 로컬 완료했다. 같은108 unit/41 JAR E2E 숫자도008의 새 로그로 확인했고 과거007 성적을 복사하지 않았다.

단순 ID 조회/쓰기는 JPA Repository와 guarded Service를 사용한다. 동적 Entity 목록은 Reference requirements/RequirementQueryRepository에서 현재 DB actor의 DRAFT 공개 조건과 검색 조건을 list/count에 함께 적용한다. 사용자 %, _, 역슬래시는 literal 검색이며 updatedAt DESC,id DESC 순서와 page/size 계약을 보존한다. 이름 조회 N+1·복잡 join/집계·SQL count/성능은009에서 구현한다. 업무 predicate/DTO/Entity를 공통 autoconfigure로 이동하지 않는다.

읽기 DTO는 RequirementReadMapper에서 변환한다. unmappedTargetPolicy=ERROR를 유지하고 새 target 필드는 명시적으로 매핑하거나 근거가 있는 ignore로 처리한다. numeric0/1·nullable 관계·빈 배열·UTC Instant.toString·opaque history JSON을 보존한다. inverse Entity mapping·자동 Setter·@Data/자동 toString을 추가하여 actor/권한/revision/history/Clock 검사를 우회하지 않는다. generated-sources의 Q/Mapper는 수정하지 않고 실제 Entity/Mapper와 부모 POM을 변경한다.

부모 POM의 fork 버전은 sc-querydsl.version이다. Boot의 querydsl.version을6.12로 바꾸면 기존 com.querydsl BOM도 변경되는 초기 실패가 있었으므로 구분한다. Compiler processor path에는 Querydsl JPA·MapStruct·Lombok·binding·Boot metadata를 함께 유지한다. Lombok은 provided만으로 Boot JAR에서 사라지지 않으므로 repackage 명시 제외와 실제 두 JAR 검사를 유지한다. python3 scripts/verify-java-processors.py는 실제 부모를 상속한 성공2개와 미매핑 compile exit1/requiredField 진단·tests 미실행을 확인하고 outer exit0으로 성공한다. 임시 경로 정리와 초기 실패 기록도 보존한다.

혼합 persistence 변경은 RequirementMixedPersistenceTest에서 같은 EMF/DataSource/JpaTM·Mapper STATEMENT 캐시·명시 flush 전후 title/revision·IDENTITY child history·commit/rollback을 검사한다. Querydsl COMMIT flush mode는 flush 전 상태를 관찰하기 위한 테스트 설정이다. 생산의 guarded Service 쓰기·history·after-commit 감사 경계를 바꾸지 않는다. 테스트용 Mapper proxy의 등록으로 생산 @Mapper scan이 backoff되지 않게 확인한다.

외부 HTTP는 명시 ReferenceEchoClient와 공통 FeignCallBoundary를 사용한다. RetryableException504·FeignException502는 고정 code/message/errors[]이며 URL·본문·예외 cause/message를 전달하지 않는다. HTTP 성공 응답의 필수 message 유효성은 앱 EchoController가 검사한다. 수신 Cookie/Authorization/CSRF는 전달하지 않고 requestId만 연결한다. 자동 retry를 추가할 때는 중복 수행·timeout 이후 늦은 요청을 먼저 검증한다. ReferenceIntegrationTest의 실제 loopback 상태/decoder/200ms read timeout/별도 closed-port 검사를 유지하며 원래 listener는 전체 테스트 종료 때만 정리한다.

## 009 보고서 수정 위치

| 수정 내용                    | 파일·경계                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| 조인·집계·공개/검색·정렬     | 앱 `reports/RequirementReportSqlMapper.xml`, stats/page 조건 함께 확인                             |
| 페이지·입력 상한·transaction | `RequirementReportService.java`, `RequirementReportController.java`, 실제 Swagger 검사             |
| JSON/null/enum               | `RequirementReportDtos.java`, `RequirementReportOpenApiConfiguration.java`, 명세 캡처 후 TS 재생성 |
| 기존 목록 이름 N+1           | `requirements/RequirementService.java` batch 조회, 응답·Querydsl 조건 유지                         |
| URL·조회·필터 입력           | `features/reports/requirements/filters.ts`, `query.ts`, `ReportFilters.vue`                        |
| 페이지·선택·보기 방식        | `RequirementReportPage.vue`, `ReportTable.vue`, 서버 자료는 Query에 유지                           |
| 서버 전체 ARIA               | 공통 `ScDataTable.vue`, `ScVirtualTable.vue`, client mode 회귀도 확인                              |
| 실제10k·브라우저             | `seed-report-fixture.py`, `e2e-reports/requirements-report.spec.ts`, 신규 자료만 사용              |

필터/정렬 변경은 page0, 보기 방식은 같은 페이지를 유지한다. 적용 URL과 제출 전 입력을 구분해 page/sort/view 전환이 초안을 지우지 않게 한다. 가상화는 받은 페이지 안에서만 수행한다. [009 검증](질의/009-복잡조회와서버표.md)의 실패·미확인도 갱신한다.

009의 로컬 구현·통합 검증을 완료했다. [최종 compact 빌드](검증/009-integration-build-compact-final.log)는 서버87·unit112/24 files·두 새 JAR이고 [기존41+보고서5 E2E](검증/009-e2e-compact-final.log)·[전체 DOM axe61회](검증/009-e2e-compact-final-summary.json)·[12장 실제 이미지 검토](검증/009-visual-review.json)를 확인했다. 보고서 UI의 재조회500/명시 retry/이전 query 지연 응답에서도 입력·선택·적용 URL·현재 페이지 자료의 소유권을 유지해야 한다. 표를 내부 named scroll에서 가로 이동시키고390px 집계 타일은2열·desktop 행동은같은행으로 유지한다. locale가 query/filter/선택을 재설정하지 않게 한다.

`npm run test:e2e`는 일반 기능 뒤 `test:reports`를 순차 실행한다. JAR bootstrap/종료 뒤 actual H2 runtime library의 offline seed를 사용하며 H2 RunScript charset는 `-options "CHARSET 'UTF-8'"`로 전달한다(`-charset` CLI 옵션 없음). 처음 실패의 H2ErrorCode50100은 SQLState로 부르지 않는다. raw SQL/hash/secret을 예외·증거에 출력하지 않는다. 캡처는 상단6장과 named 결과의 문서좌표+최대1100px6장을 따로 남겨 작은 폭의 실제 표를 빠뜨리지 않는다. 생성 output만 ignore하며 source/타입/axe 검사는 유지한다. 입력/화면 변경 뒤 최신 프런트가 포함된 JAR를 새로 준비한다.

시각 기준 변경은 actual/diff 검토 뒤 명시 run으로만 수행한다. 009은 sidebar 보고서 메뉴의 의도한18928pixel 차이를 검토하여 갱신했고 정상4 PASS·고의1436pixel 차이 차단/17파일 불변을 확인했다. 006/007 frozen baseline을 변경하지 않는다. Linux/원격/VoiceOver·incomplete117 수동 후보는 로컬 정상 비교와 분리한다.

## 011 패키지·생성기와 012 운영을 수정할 때

[011 준비 검토](질의/011-배포와생성기-준비검토.md)에 따라 다섯 패키지의 dist JS/declaration·공개 exports·CSS/Sass·내부 UNLICENSED/OSS 고지를 함께 관리한다. 실제 tarball과 격리 Maven artifact를 레포 밖 새 consumer에서 설치하고 source alias 없이 build/JAR를 확인한다. 생성기는 occupied/symlink 경로를 덮어쓰지 않으며 dry-run·새 lock 재현·버전 upgrade/rollback을 검사한다. 공개 npm 게시·사용자 코드 자동 병합을 완료 조건으로 추가하지 않는다.

012의 파일 정리는 [010 파일 저장 계약](질의/010-파일저장계약.md)의 crash orphan·영속 삭제 큐/재시도와 DB/blob 동시 복원을 검사한다. 감사 sink 실패 counter는 영속 전달 보장이 아니므로 durable/outbox·retention·민감값 제외 회귀를 연결한다. RabbitMQ/Quartz·Prometheus/Grafana·trace/error 수집·Docker/Compose는 [조건부 전체 목록](질의/조건부기술-전체구현.md)의 실제 실행·재기동·실패 검증을 완료해야 하며 Redis/JWT/SSO는 계속 제외한다.

010 보드의 controlled 자료는 배열 identity만으로 focus 복귀를 판단하지 않는다. 같은 배열 splice의 key 순서·목적 열/beforeKey·pending identity·사용자가 이미 옮긴 focus를 검사하며 native 대체 이동도 유지한다. [관련17 초기 실행](검증/010-e2e-final-related.log)의15 PASS/2 FAIL과 수정 후 전체74 PASS를 분리한다. image trusted drag/resize Escape는390/1366px에서 canvas 변화·복구와 normalized 좌표를 실제 검사했지만 list reporter가 inline JSON body attachment를 보존하지 않아 별도 해시 파일이 있다고 기록하지 않는다.

[010 시각 승인](검증/010-visual-approved.json)은 초기19054pixel/1 FAIL·3 PASS를 actual/diff로 검토하여 Reference1366 셸1PNG+manifest만 명시 갱신한 결과다. 정상4 PASS는 baseline 변경0이며 negative1436pixel의 의도한1 FAIL에서17개 baseline SHA 불변을 확인했다. axe incomplete232 rule instances/2121 nodes와 VoiceOver 실제 음성·Linux·원격 CI는 수동/별도 검증으로 남긴다.

### 011 실제 수정 순서와 검증 위치

공통 UI 기능은 기존 `src/` SFC와 자체 contracts를 수정한다. compiled 파일을 손으로 고치지 않는다. UI 공개 경로를 추가/제거하면 `source-entries.json`의8키·manifest compiled exports·계약 snapshot을 함께 확인한다. 변경 뒤 package-local library build가 새 JS/선언/CSS·완성 stamp를 만들고 source/config digest가 달라진 이전 dist는 pack하지 못한다. 구체 설정은 [생산 설계](질의/011-공통패키지-배포설계.md)를 따른다.

AST 후처리는 상대 declaration specifier만 다루며 중첩 generic·`.vue.d.ts` 대상도 검사한다. 선언이 vendor를 추론해 직접 참조하면 실제 exact dependency로 제공해야 한다. 실제 누락 table-core9.2.6/virtual-core3.17.11은 direct 선언·NOTICE 재생성으로 수정했다. 버전 변경은 package/루트 단일 lock을 함께 갱신하고 설치·audit·library build를 재확인한다. Vue I18n11.1.12/devtools-types11.1.12의 strict 호환 조치는 이전005~010 실행 버전에 소급하지 않는다.

UI `strict:true/skipLibCheck:true`는 자체 source·공개 Props/Emits/Slots의 검사를 유지한다. runtime/date/excel/i18n은 producer 및 실제 외부 non-UI strict 검사를 false로 통과했다. [외부 UI probe](검증/011-consumer-types-v02.json)는 vendor696개·자체0이며 vendor를 patch하거나 진단을 숨기지 않는다. 지원 설정의 public positive/negative12개 사례와 strict-vendor 실패는 다른 판정이다.

생성 템플릿 변경은 현재61파일 allowlist의 hash/mode와 [경계48개](검증/011-generator-v02.json)·dry-run·새 target을 함께 확인한다. 새 앱74파일은 vendor12와 provenance를 포함하며 기존 생성 앱을 재생성으로 덮어쓰지 않는다. 이전60/73·46/47 실행 기록은 당시 성적으로 보존한다. 최초 parent repository와 후속 CLI property의 early model 실패는 각각 초기 로그에 남겼고 Maven settings active profile bootstrap 수정 후 [cold build 세 번째](검증/011-consumer-build-third.log)의 서버5개까지 통과했다.

[011의0.2.0 pack/gate](검증/011-package-artifacts-v02.json)는 npm5/Maven7·[negative25/보호128불변](검증/011-package-gates-v02.json)을 통과했다. 공통0.1.0의 [candidate4 브라우저](검증/011-generated-fourth/browser/summary.json)는7그룹·전체 DOM axe4·PNG4, HTTP/H2는2그룹을 확인했다. JSON 출력 pre는 이름 있는 region/tabindex0로 실제 ArrowDown 스크롤을 제공한다. [생성 프로필9그룹](검증/011-generated-features-second.json)은 기본 prod OFF·선택6조합·런처/PID 소유권을 확인했고 최초 `ps` fixture 실패를 보존한다. `.github/workflows/verify.yml`의 별도 `package-consumer` job에도 같은 검증을 연결했으며 원격 실행은 미확인이다.

새 검사 위치는 `scripts/verify-generated-app.py`·`verify-generated-features.py`·`verify-package-upgrade.py`다. upgrade는 독립 lock과 검증한0.2.0 세트를 적용하고 기존 Notes/H2·손작성 source·정규화 API를 보호한다. [첫 실제 실행](검증/011-upgrade-first-failure.json)은 빌드에 성공했지만 생성 OpenAPI의 동적 서버 포트를 소스 변경으로 오인한 guard에서 중단됐다. 소스 변경0·정규화 API 동일이며 첫 archive를 보존한다. 두 번째 upgrade/rollback과 compiled Catalog Docs22/Controls10이 모두 통과하여011 로컬 완료로 기록한다.

[011 fresh 통합](검증/011-server-and-artifacts-first.json)의139unit/143서버·static35/5, [74 E2E](검증/011-e2e-first.log)·[axe111](검증/011-e2e-axe-summary.json)의0violations/중복ID0·incomplete232/2117nodes와 [정상 시각4/baseline17불변](검증/011-visual-final.json)을 확인했다.010의46/6·2121nodes는 당시 기록을 유지한다. live API2/타입3·원본170변경0도 별도로 확인했다. VoiceOver 수동 음성·incomplete 후보·Windows·Linux 시각·원격 CI와012 운영은 미확인이다.

### 011 최종 로컬 확인과 당시012 준비 경계

[compiled Story95/28 files](검증/011-stories-controls-final.log)와 [정적 Docs22/Controls10](검증/011-storybook-browser.json)은 모두 실제 통과했고 브라우저 오류/API 누출은0이다. 첫 color 누락·Controls0/10 실패는 별도 로그/report에 보존한다. [0.2.0 외부 public 소비](검증/011-consumer-types-v02.json)의 native4/type12/private3/XLSX/Sass와 [0.2.0 생성기48](검증/011-generator-v02.json)도 통과했다. UI vendor strict696/자체0·다른4 strictfalse0의 지원 경계는 유지한다.

[실제 upgrade/rollback 두 번째](검증/011-upgrade-rollback-second/summary.json)는0.1.0→0.2.0→0.1.0을 같은H2에서 통과했고 Notes revision1/2/3, 보호 업무 source47개 변경0·API 동일(`servers`만 정규화 제외)·공통JAR 정확한 바이트·기존lock 완전 복원을 확인했다. API·DDL이 같은 cohort의 전환 결과이며 파괴적 schema migration·사용자 코드 자동 병합을 지원한 결과가 아니다. 첫 build PASS/동적 server-port guard 실패 증거는 불변 보존한다.

[외부 optional OFF JAR](검증/011-generated-optionaloff/summary.json)는 HTTP2/browser4·선택chunk 요청0을 확인했다. [격리 내부 OFF](검증/011-starter-features.json)는 기본build 불변·요청0·선택chunk2개 emitted를 확인했으므로 완전한 번들 제거로 설명하지 않는다. [생성 프로필9/선택6](검증/011-generated-features-second.json)와 기본prod OFF도 통과했다.011은 구현·로컬 검증 완료다.012는 [CI 준비 정적 검사](검증/012-preparation-ci-check.json)의 YAML·Bash36·Python3 통과만 확인했고 remoteExecution/consumerExecuted/dependencyInstallExecuted는false다. 이 문단은 011 마감 당시의 준비 기록이다. 현재 012의 구현·실제 실행 범위는 아래 012 절에서 구분한다. 원격CI·Windows·Linux시각·VoiceOver/incomplete수동은 미확인으로 유지한다.

## 012 운영 화면과 수집기를 수정할 때

현재012는 구현·로컬 검증을 완료했다. 기존 공통 UI22개를 그대로 사용하며 운영 메뉴·폼·권한·Query는 앱 소유다. Redis·JWT·SSO는 추가하지 않는다.

| 변경 대상                  | 수정 위치·유지할 계약                                                                                                                 | 검증                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 운영 활성·ADMIN 메뉴       | 두 앱 `features/operations/capabilities.ts`, `App.vue`와 앱 서버 `application-operations.yml`                                         | 인증 후 capabilities Query 성공/ON일 때 활성. OFF 기능 HTTP0·기존 탐색 유지, 서버 ADMIN 재검사                         |
| 메시지 필터·DEAD 재시도    | Reference `MessagesPage.vue`, Starter `MessagesPanel.vue`·각 `api.ts`                                                                 | Router page/type/state·DEAD 확인 dialog·202·완료/다른 상태409. 자동 retry/임의 payload 입력 금지                       |
| 예약·기준 revision         | Reference `SchedulesPage.vue`, `ScheduleForm.vue`, Starter `SchedulePanel.vue`                                                        | Query list/detail/jobs/runs·URL id/page/runPage. VeeValidate/Zod·400 필드 오류·409/GET500 입력/기준 보존·late A→B 폐기 |
| 브라우저 집계·이력         | Reference `BrowserErrorsPage.vue`, Starter `BrowserPanel.vue`                                                                         | Query와 Router 그룹/이력 페이지. safe 코드·시각/actor만 표시. 원문 message/stack 표시 없음                             |
| 공통 오류 hook             | [browserErrors.ts](../frontend/packages/runtime/src/browserErrors.ts), [spec](../frontend/packages/runtime/src/browserErrors.spec.ts) | 기존 Vue handler 보존·실제 template 이벤트·동일 Error dedupe·generation 폐기·실패 재수집0·dispose                      |
| route/appVersion allowlist | 각 앱 collector 설정·서버 browser-errors 설정, v2 템플릿                                                                              | Router name 고정 등록값 일치·appVersion 앱 own release. URL/query/입력값을 routeCode로 만들지 않음                     |
| 영속 메시지·삭제·감사      | framework `messaging/`, `audit/`, `storage/`와 앱 adapter                                                                             | 같은 DB/TX outbox/inbox·confirm/ACK crash·5회/DLQ·명시 retry·참조 파일 보호                                            |
| 예약·오류 서버             | framework `scheduling/`, `browsererrors/`·두 앱 `operations/`                                                                         | seconds0 Quartz 6/7필드·IANA·revision·JDBC 재기동·receipt/rate/retention                                               |
| 관측·복원                  | `infra/operations/`, `compose.operations.yaml`, `scripts/verify-*.py`, `backup-runtime.py`, `restore-runtime.py`                      | 실제 datasource query/trace 연결·bounded labels·canary0·같은 JAR/정지 H2/blob·새 빈 root·runtime lock                  |

예약 폼의 입력 원본은 하나의 VeeValidate 문맥이다. 조회 detail은 Query가 소유하고, 폼은 선택/수락한 저장/명시 reload에서만 기준 값을 초기화한다. background refetch로 draft를 덮지 않는다. stale409 후 GET500은 기존 conflict 안내·입력·revision을 유지한다. 새 예약/다른 선택/이탈은 native 확인 dialog에서 취소할 수 있고, logout은 새 세션 입력과 응답을 섞지 않는다. 예약 기본 cron은 `0 * * * * ?`이며 cron 최대120자·6 또는7필드·seconds0, timeZone 최대64자다. 등록 작업은 실제 `registered` API 목록으로 검증한다.

수집기는 `createBrowserErrorCollector` 공개 factory를 사용한다. `appVersion`은 기본 `0.1.0`, 최대64자의 유효 SemVer이며 앱이 명시한다. internal 두 앱은 `0.1.0`, v2 생성 앱은 `1.0.0`이다. Vue handler/window error/unhandled rejection에서 원문 message/stack/info/url을 읽어 정제하지 않고 처음부터 코드 DTO만 만든다. 로그인 전/OFF/미등록 route는 전송0, 같은 Error는 한 번, 큐는 최대20개·재시도0이다. 수집 요청 실패를 다시 수집하거나 새 console/telemetry 원문을 남기지 않는다. 등록/해제는 해당 앱 수명과 세션 generation을 따른다.

<details>
<summary>012 초기 구현·중간 검증 이력 — 아래 대기 표시는 당시 상태</summary>

[담당 단위10개](검증/012-operations-focused-unit-final.log), [runtime](검증/012-runtime-typecheck-final.log)·[Reference](검증/012-reference-typecheck-final.log)·[Starter](검증/012-starter-typecheck-final.log)·[E2E](검증/012-e2e-typecheck-final.log) 타입, [scoped 형식](검증/012-frontend-scoped-format-final.log)·[lint](검증/012-frontend-scoped-lint-final.log)는 통과했다. 실제 Vue throw는 template 사용자 이벤트 단위 fixture로 확인했다. 실제 JAR의 window/rejection·운영 폼/권한/언어/390·1366/whole DOM axe는 작성된 [운영 E2E](../frontend/e2e/012-operations.spec.ts)를 Root가 새 JAR로 실행한 뒤 확정한다. 제품 오류 버튼/debug 전역은 추가하지 않는다. 초기 V8 stack fixture·생성 타입 대기·lint 경고의 실패 기록도 보존한다. 상세 서버 계약은 [메시지·복구](질의/012-메시지와복구계약.md), [예약·오류](질의/012-예약과브라우저오류.md)를 따른다.

[운영 첫 브라우저10개](검증/012-operations-e2e-first.log)는4 PASS/6 FAIL이었다.2개는 예약 행 버튼의 visible 선택 문구가 aria-label에 빠진 실제 `label-content-name-mismatch`,4개는 이미 있는 PULSE를 다시 생성해 등록 작업당 예약 하나(`job_code UNIQUE`) 계약에409가 발생한 fixture 오류다. [초기 axe JSON·PNG](검증/012-operations-e2e-first-results/)를 보존했다. 두 앱의 accessible name에 실제 ko/en visible 문구를 포함했고 테스트는 기존3개 system 예약과 PULSE1개를 사용하며 현재 revision으로 설정을 복원한다. DB·공통 UI·axe rule은 바꾸지 않았다. 수정 소스의 scoped 형식/lint·두앱/E2E 타입은0이며 실제 새 JAR 재실행은 진행 중이다.

### 012 후속 실제 실행과 남은 브라우저 재검증

[프런트 verify](검증/012-frontend-verify-first.log)의149 unit과 [서버 다섯 번째](검증/012-backend-verify-fifth-summary.json)의196개/실패·오류·skip0을 확인했다. 앞선 담당 unit10/서버195는 당시 실행으로 보존하고 중복 합산하지 않는다. [관측 다섯 번째](검증/012-observability-fifth.json)는8그룹 PASS, [실제 Grafana 브라우저](검증/012-grafana-browser-second/summary.json)는5개 metric query populated·11 data frame·6개 panel visible·pageerror0을 확인했다. raw canary0·trace6span/Loki1log와 manualReviewComplete=false 경계는 유지한다.

[Docker 세 번째 image build](검증/012-docker-app-build-third.log)와 [네 번째 앱 컨테이너7그룹](검증/012-docker-operations-fourth.json)도 실제 통과했다. prod,operations·UID10001/umask077·secret600·Flyway7·MESSAGE_DEMO 완료·예약 revision409·PDF/revision 보존·앱만 재기동/인프라6 ID불변·별도 management observer/Prometheus up을 확인했다. 당시 container/volume은 부모 검증을 위해 남겨 둔 상태이며 종료/회수까지 완료했다는 결과는 아니다. 기존 첫/두 번째 build 실패를 보존하고 로컬 컨테이너 성공을 원격 배포/HA/power-loss 보장으로 확대하지 않는다.

[운영 두 번째10개](검증/012-operations-e2e-second.log)는7 PASS/3 FAIL이다. 앞선 제품 ARIA와 fixture UNIQUE 문제는 해결됐고 409/GET500·늦은A→B·실제 window/rejection·Starter 소비는 통과했다. 남은1개는 첫 dialog visible/focus 확인 전 Escape를 보낸 race,2개는 새 document goto에서 기본KO로 초기화된 뒤 EN 표를 찾은 fixture다. [두 번째 결과/PNG/axe](검증/012-operations-e2e-second-results/)를 보존했다. dialog visible→취소 focus→Escape→닫힘과 재확인 후 URL을 기다리고, EN은 실제 SPA RouterLink로 이동하며 locale를 확인하도록 E2E만 수정했다. 임의 sleep·force click·locale 영속화·공통UI/DB/axe rule 변경 없이 scoped 형식/lint/E2E 타입0을 확인했다. 실제10 재실행·전체 회귀·시각·Story/Docs/Controls·0.3 pack/v2 소비와012 종합 마감은 아직 진행 중이다.

후속 정적 action 점검에서도 두 앱의 오류 그룹 행 버튼에 visible `발생 이력`/`Occurrence history`가 accessible name에서 빠진 같은 결함을 확인해 해당 앱 SFC 두 곳만 수정했다. 메시지 재시도·예약 선택·다른 운영 action도 visible 문구 포함 여부를 점검했다. scoped 형식/lint·두 앱 타입은0이며 이 후속 제품 수정은 새 JAR와 v2 소비 앱의 실제 axe 결과로 확인할 예정이다. 공통 UI/runtime·DB·규칙 제외·원문 오류 노출·locale 영속화는 추가하지 않았다.

</details>
