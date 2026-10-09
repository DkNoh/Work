# 004 — Storybook 공통 UI 카탈로그

상태: **004 구현·로컬 검증 완료**. 공개 metadata·정적 Docs/Controls·합성 API 격리·5파일/22개 story 기능/a11y를 실제 확인했다. 최종 결과와 초기 실패는 아래 기록에 구분한다. 마지막 문서 편집 후 format/lint와 최종 정적 build/browser 재확인은 별도 마감 확인으로 남긴다.

공통 UI는 Storybook에서 공개 계약과 상태별 동작을 확인하고 Reference·Starter 앱에서 소비한다. 업무 API·Router·Vue Query·폼·세션의 원본은 앱/runtime에 유지한다. [UI 공개 계약](UI-공개계약.md)과 [전체 구현 대상](조건부기술-전체구현.md)을 함께 따른다. 조건부 기술도 실제 구현·예제·기능 테스트 대상이며 Redis·JWT·SSO는 제외한다.

## 004의 결과물과 수정 위치

| 위치                                                                                           | 책임                                                                       | 수정 기준                                                                |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Catalog package](../../frontend/apps/catalog/package.json)                                    | Storybook·docgen·MSW·브라우저 테스트의 직접 의존성 및 workspace 명령       | 루트 manifest·단일 package-lock과 함께 변경                              |
| [main.ts](../../frontend/apps/catalog/.storybook/main.ts)                                      | Vue3-Vite, stories 검색, addons, docgen, 정적 파일, 개발 파일 접근 제한    | 공통 UI를 실제 Vue SFC로 컴파일하고 실행 자료·secret을 노출하지 않음     |
| [preview.ts](../../frontend/apps/catalog/.storybook/preview.ts)                                | Vuetify·공통 styles, Autodocs, MSW loader, frame, Controls, a11y, viewport | 앱의 테마와 같은 공개 UI를 소비하고 story마다 숨은 앱 상태를 만들지 않음 |
| [tsconfig.docgen.json](../../frontend/apps/catalog/tsconfig.docgen.json)                       | imported 공개 타입과 UI SFC의 docgen 분석 범위                             | Catalog 소스·설정과 `packages/ui/src`를 포함하며 UI 단위 테스트는 제외   |
| [Catalog stories](../../frontend/apps/catalog/src)                                             | CSF metadata, args, 상태별 예제, play assertion                            | `component`는 문서화할 실제 공개 컴포넌트로 지정                         |
| [SFC fixtures](../../frontend/apps/catalog/src/fixtures)                                       | 예제의 HTML·slot 조립·합성 로컬 상태                                       | `<template>` → `<script setup lang="ts">` → `<style>` 순서               |
| [vitest.config.ts](../../frontend/apps/catalog/vitest.config.ts)                               | Storybook Vitest plugin과 Playwright Chromium 실행                         | story 렌더·play·a11y를 실제 브라우저에서 확인                            |
| [ui-contracts.mjs](../../scripts/ui-contracts.mjs) · [ui-contracts.json](../ui-contracts.json) | 공개 UI props·events·slots·default의 자동 추출과 변경 감지                 | 생성 결과를 직접 편집하지 않고 계약 변경을 검토한 뒤 재생성              |
| [check-ui-boundaries.mjs](../../scripts/check-ui-boundaries.mjs)                               | 공통 패키지→소비 앱 참조와 UI 내부 경로 소비 검사                          | 공개 `@sc/ui`, `@sc/ui/styles`, `@sc/ui/tokens` 경계를 유지              |

정적 Storybook의 Docs/Controls는 `node scripts/verify-storybook.mjs`로 확인한다. 로컬 임시 정적 HTTP 서버와 Chromium을 만들고 종료하며 실제 브라우저·API 누출 결과와 캡처를 `docs/검증/004-*`에 기록한다. Storybook 출력은 업무 프런트 `dist` 및 Spring JAR과 분리한다.

## 현재 의존성과 설치 상태

2026-10-06 기준 manifest에 지정한 버전이다. 의존성 선언·잠금 파일 변경은 재현 설치와 기능 실행 성공을 뜻하지 않는다. 설치된 상태의 기준은 루트 `package-lock.json`과 `npm ci` 결과다.

| 구성                                           | 지정 버전          | 용도                                                                         |
| ---------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| Storybook · Vue3-Vite · docs/a11y/vitest addon | `10.4.1`           | 카탈로그·자동 문서·접근성·story 테스트                                       |
| `vue-component-meta`                           | `2.2.12`           | imported Props/Emits/Slots와 기본값 추출; Catalog 직접 의존성                |
| `vitest` · `@vitest/browser-playwright`        | `4.1.11`           | 브라우저 story 검증; 보안 수정 버전으로 manifest/lock 갱신                   |
| `playwright`                                   | `1.63.0`           | Chromium 테스트 실행                                                         |
| `msw` · `msw-storybook-addon`                  | `2.13.0` · `2.0.7` | 합성 HTTP와 story별 handler                                                  |
| Catalog 직접 의존성·루트 override의 `esbuild`  | `0.28.1`           | Storybook loader에서 실제 해석할 의존성을 명시하고 workspace 버전을 일치시킴 |

단일 npm 잠금 파일을 유지한다. `package-lock-only` 갱신만으로 성공을 판단하지 않고 clean staging에서 lock을 재생성한 뒤 `npm ci`·build·관련 브라우저 테스트를 확인했다. 초기 설치/빌드 실패와 복구는 아래에 보존한다. Vitest/브라우저 provider를 한쪽만 다른 버전으로 올리지 않는다.

## 카탈로그 분류와 SFC 작성

현재 stories는 다음과 같이 분류되어 있다.

| Storybook 분류         | 실제 story                     | 확인할 책임                                            |
| ---------------------- | ------------------------------ | ------------------------------------------------------ |
| 디자인 기반/토큰       | `DesignTokens.stories.ts`      | 의미색·간격·한국어 타이포·반경/그림자·반응형·포커스    |
| 공통 UI/ScActionButton | `ScActionButton.stories.ts`    | 기본·disabled·busy·키보드·native form·submit           |
| 공통 UI/ScTextField    | `ScTextField.stories.ts`       | 문자열 model·label·error description·readonly·disabled |
| 공통 배치/ScAppShell   | `ScAppShell.stories.ts`        | 메뉴·slot 조립·긴 한국어·본문 이동·모바일 dialog       |
| 조립 예제/모의 조회    | `ConnectedExamples.stories.ts` | 독립 runtime과 MSW 정상/오류 응답                      |

공통 UI 파일·import는 `ScActionButton`, 템플릿은 `<sc-action-button>`, 공통 CSS는 `.sc-*`를 사용한다. fixture의 업무 제목·조회 상태는 예제의 로컬 상태이며 공통 패키지의 새 전역 상태로 만들지 않는다. stories 파일에는 metadata·args·test를, 화면 HTML과 slot 콘텐츠는 `.vue` fixture에 둔다.

CSF의 `render` callback은 Vue의 `components/setup/template` 설정 객체를 반환한다. 실제 UI를 `h()`·JSX·TSX 렌더 함수로 작성하지 않는다. 일반 부품은 `ScStoryFrame`의 Vuetify app/main 안에 표시하고 `ScAppShell`은 `scFrame: "shell"`로 별도 frame을 생략한다. 셸의 app/main을 중첩하지 않는다. 일반 frame의 `.v-application__wrap`은 scoped 스타일로 `min-height: auto`, 콘텐츠는 최소 240px로 두어 Docs마다 전체 viewport 높이의 빈 공간을 만들지 않는다. 앱의 실제 셸 높이 정책과 구분한다.

## 공개 타입에서 자동 문서 추출

`main.ts`는 `@storybook/vue3-vite`의 `docgen`을 `vue-component-meta`로 지정하고 `frontend/apps/catalog/tsconfig.docgen.json`을 사용한다. 이 경로는 workspace의 Catalog 작업 디렉터리가 아닌 Storybook `getProjectRoot()`가 반환하는 저장소 루트 기준이다. 공식 Vue3-Vite 문서는 imported 타입을 분석하는 docgen과 props·events·slots·JSDoc 문서 추출, 별도 tsconfig 지정을 지원한다. 현재 버전의 기준은 [Storybook 10.4.1 Vue3-Vite 문서](https://raw.githubusercontent.com/storybookjs/storybook/v10.4.1/docs/get-started/frameworks/vue3-vite.mdx)다.

실제 UI SFC는 `defineProps<ScTextFieldProps>()`, `defineEmits<ScTextFieldEmits>()`, `defineSlots<ScTextFieldSlots>()`처럼 공개 타입을 import한다. 타입의 JSDoc은 의미와 제약을 설명하고 `withDefaults`는 실제 기본값을 정의한다. story의 `args`는 예제의 시작값이다. 예를 들어 버튼 story의 `busyLabel: "저장 중…"`와 컴포넌트의 기본값 `"처리 중…"`를 같은 값으로 기록하지 않는다.

| 자동 추출 대상 | 검토 기준                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Props          | 이름·필수 여부·값 타입이 공개 `Sc...Props`와 일치하며 내부 Vuetify `density/theme/elevation` 등이 섞이지 않음 |
| Defaults       | SFC `withDefaults` 값과 일치; 필수 prop의 기본값 없음과 optional `undefined`를 구분                           |
| Events         | `click`, `update:modelValue`, `navigate`와 native event tuple 타입이 공개 Emits와 일치                        |
| Slots          | 이름과 설명이 공개 Slots에 일치; slot 콘텐츠와 payload의 역할을 사람이 확인                                   |
| JSDoc          | 사용자가 결정해야 할 의미·제약·접근성 책임을 설명하며 story의 별도 업무 규칙을 공개 계약에 섞지 않음          |

현재 자동 snapshot은 `ScActionButton`, `ScTextField`, `ScAppShell` 세 공개 컴포넌트를 분석한다. `npm run ui:contracts:check`는 소스에서 다시 추출한 결과와 `docs/ui-contracts.json`의 차이를 실패로 처리한다. 공개 계약 변경은 [UI 공개 계약](UI-공개계약.md)의 호환성·폐기 정책을 먼저 검토하고 `npm run ui:contracts:generate`로 갱신한다. 새 공통 부품은 추출 대상에도 추가한다.

초기 Catalog tsconfig만으로 추출했을 때 `Could not find main source file` 오류가 발생하여 docgen 전용 tsconfig에 UI `.ts`·`.vue`를 명시적으로 포함했다. 이후 snapshot은 전체 props를 추출했지만 정적 Docs는 story args의 두 prop만 표시하여, Storybook의 저장소 루트 기준 tsconfig 경로를 수정했다. 추가 분석에서는 `mergeConfig`로 뒤에 추가한 Vue 컴파일러보다 docgen이 먼저 실행되어 `_sfc_main`의 metadata 연결이 생략된 문제를 확인했다. `merged.plugins = [vue(), ...(base.plugins ?? [])]`로 컴파일을 먼저 배치한 뒤 정적 Docs의 전체 공개 표를 확인했다. 분석 대상·경로·plugin 순서를 확인하고 수정하며, 문서를 수동 `argTypes`로 채워 오류를 감추지 않는다.

preview의 `argTypesEnhancers`는 추출된 문자열 default의 Unicode escape를 해독하여 한국어를 읽기 쉽게 표시한다. 실제 기본값·필수 여부·타입·event/slot 계약은 바꾸지 않는다. events/slots/exposed category는 `control: false`로 두어 fixture가 조립하는 콘텐츠·이벤트를 props 편집기에서 바꾸지 않으며, `$`로 시작하는 내부 exposed 항목은 표에서 제외한다. category가 optional인 타입은 빈 문자열 기준으로 처리한다. 공개 events/slots 표 자체는 유지한다.

현재 docgen snapshot의 payload 없는 slot은 `type: "any"`로 표시된다. 이 추출 표현이 무제한 slot payload를 보장하지 않는다. 버튼 default와 셸의 default/header-actions/sidebar-footer/notice는 payload가 없는 실제 공개 Slots 타입 및 사용 SFC와 대조한다. 메타데이터 비교만으로 타입 의미 전체를 검증했다고 판단하지 않는다.

HTML/ARIA/data 속성의 allowlist·예약 속성·DOM 전달 위치도 props 표만으로 자동 문서화되지 않는다. `inheritAttrs: false`와 선별 전달의 실제 계약을 [UI 공개 계약](UI-공개계약.md)에 유지한다. Vue의 `useAttrs()`는 최신 속성을 제공하지만 반응형 watch의 원본이 아니므로, 동적으로 바뀌는 attrs를 렌더 시점에 선별해야 한다. [Vue fallthrough attributes](https://vuejs.org/guide/components/attrs.html)

## Controls와 예제 상태의 양방향 연결

Controls는 args를 바꾸고 예제를 다시 표시한다. 자동 추출된 argTypes를 기본으로 사용하고, 추가 control 설정은 표시 방식·선택지에 한정한다. 실제 공개 타입·기본값을 다른 값으로 덮어 쓰지 않는다. 기본 사용법은 [Storybook Controls](https://storybook.js.org/docs/essentials/controls)를 따른다.

입력 model과 셸의 현재 메뉴는 다음 두 방향을 연결한다.

```text
Controls → Storybook args → fixture props → Sc UI
Sc UI model event → fixture의 로컬 입력값 즉시 변경
입력의 native change → fixture commit:modelValue → useArgs/updateArgs → args → Controls
셸 navigate → fixture navigate → useArgs/updateArgs → args → Controls
```

현재 `ScTextFieldStory`는 `update:modelValue`에서 로컬 ref와 입력 미리보기를 즉시 갱신하고 같은 event를 emit한다. Storybook manager의 Controls 값에는 입력의 native `change`가 발생할 때 fixture 전용 `commit:modelValue`를 emit하여 반영한다. CSF는 이 commit만 `useArgs()`의 `updateArgs({ modelValue })`에 연결한다. `change`는 보통 변경한 텍스트의 blur/확정 시 발생한다. Controls에서 바꾼 외부 model은 watch로 fixture에 반영한다. `ScAppShellStory`의 `navigate(item)`은 `updateArgs({ activeItem: item.id })`에 연결한다. 실제 양방향 동작과 입력 reset을 [정적 브라우저](../검증/004-storybook-browser.json)에서 확인했다. args 변경 API는 [Storybook Args의 useArgs](https://storybook.js.org/docs/writing-stories/args#setting-args-from-within-a-story)를 따른다.

초기 정적 verifier가 Default story의 `play` 타이핑이 끝나기 전에 manager의 Controls tab을 눌러 iframe의 포커스를 빼앗았고, `"긴 한국어 제목"` 입력이 중간에서 멈춘 실제 실패를 확인했다. 이를 비동기 args echo만의 문제로 단정하지 않는다. 최종 verifier는 입력·탐색의 Default play 결과를 먼저 기다린 뒤 manager Controls를 조작한다. [포커스 간섭 실패](../검증/004-storybook-browser-focus-interference.json)를 보존한다.

fixture는 입력 중 로컬 draft를 즉시 반영하고 native change에서 manager args를 확정하는 정책을 사용한다. **이 정책은 Catalog fixture의 manager 연결에만 적용한다.** 공통 ScTextField의 공개 `update:modelValue`와 업무 앱의 `v-model`은 입력마다 즉시 갱신하는 계약을 유지한다. `commit:modelValue`는 ScTextField의 새 공개 event가 아니다.

fixture의 연결 예시는 다음과 같다. UI 입력값을 변경할 때 props를 직접 수정하지 않는다.

```vue
<template>
  <sc-text-field
    v-bind="props"
    :model-value="title"
    @update:model-value="changeTitle"
    @change="commitTitle"
  />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ScTextField, type ScTextFieldProps } from "@sc/ui";

const props = defineProps<ScTextFieldProps>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  "commit:modelValue": [value: string];
}>();
const title = ref(props.modelValue);
function changeTitle(value: string) {
  title.value = value;
  emit("update:modelValue", value);
}
function commitTitle() {
  emit("commit:modelValue", title.value);
}
watch(
  () => props.modelValue,
  (value) => {
    title.value = value;
  },
);
</script>
```

CSF의 연결은 실제 카탈로그와 같이 template 기반으로 작성한다.

```ts
import type { Meta } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { ScTextField } from "@sc/ui";
import ScTextFieldStory from "./fixtures/ScTextFieldStory.vue";

const meta = {
  component: ScTextField,
  args: { modelValue: "", label: "제목" },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScTextFieldStory },
      setup: () => ({ args, updateModel: (modelValue: string) => updateArgs({ modelValue }) }),
      template: "<ScTextFieldStory v-bind='args' @commit:model-value='updateModel' />",
    };
  },
} satisfies Meta<typeof ScTextField>;
export default meta;
```

Controls의 문자열·boolean·union·메뉴 배열은 직렬화 가능한 합성 args로 제공한다. native Event·Vue 컴포넌트·서비스 인스턴스·QueryClient를 args에 저장하지 않는다. 버튼 클릭 횟수와 폼 제출 결과는 fixture에서 표시하며 모든 emit을 새 prop이나 전역 상태로 바꾸지 않는다.

정적 Storybook 검사에서는 Docs의 props/default/events/slots 표가 존재하는지, 내부 Vuetify prop이 노출되지 않는지, Controls 변경이 canvas에 반영되는지, canvas의 입력 확정/메뉴 변경이 Controls로 돌아오는지 확인한다. 빠른 연속 입력 중 로컬 값과 미리보기가 잘리지 않는지, change 이후 Controls가 최종 값을 표시하는지도 확인한다. Reset Controls 후 초기 args로 돌아오는지도 확인한다. readonly/disabled 상태에서는 사용자의 편집이 차단되면서 부모가 바꾼 args는 계속 표시되어야 한다.

## MSW와 API·세션 분리

`ConnectedExamplesStory`는 story별 `createFrameworkRuntime`과 `createMemoryHistory()`를 만들고 해당 runtime의 단일 client로 `/examples`를 조회한다. 서버 자료는 그 runtime의 QueryClient에만 둔다. unmount에서 `runtime.dispose()`로 요청·캐시·런타임 자원을 정리한다. 다른 story의 Query·Router·세션 상태를 재사용하지 않는다.

현재 MSW 예제는 `GET /api/examples` 정상 목록과 HTTP 500 오류를 합성한다. 정상 응답은 `items/total/page/size`, 오류 응답은 `code/message` 계약을 따른다. 실제 계정·DB·업로드·bootstrap secret·운영 쿠키를 fixture나 정적 public에 넣지 않는다. Query를 Pinia로 복사하거나 예제에서 별도 Axios/fetch client를 만들지 않는다.

초기 `initialize({ onUnhandledRequest: "bypass" })`만으로는 미등록 업무 요청을 막지 못했다. 다음 callback의 `/api` 검사와 `print.error()`도 정적 브라우저에서 실패했다. `/api/storybook-unhandled-probe`가 실제 로컬 HTTP 서버에 도달하여 404가 반환되었다. 설치된 MSW 2.13은 legacy callback의 `print.error()`를 로그 출력만 수행하는 `defaults.error`에 연결하고, callback이 끝나면 `passthrough()`한다. 단순 로그를 네트워크 차단으로 해석했던 초기 실패를 보존한다. [MSW 2.13 공식 구현](https://raw.githubusercontent.com/mswjs/msw/v2.13.0/src/core/experimental/on-unhandled-frame.ts)

현재는 `initialize`의 initialHandlers에 `/api`와 `/api/*` 최종 fallback을 등록하여 미정의 업무 요청에 `HttpResponse.error()`를 반환한다. 등록한 정상/HTTP 500 story handler는 addon의 `worker.use()`로 앞에 추가된다. story 변경 시 `resetHandlers()`를 호출해도 initial fallback은 유지된다. `onUnhandledRequest: "bypass"`는 이 fallback 밖의 정적 자산을 허용하며, API 요청 차단은 문자열 옵션이 아닌 실제 handler가 담당한다.

```ts
import { initialize } from "msw-storybook-addon";
import { http, HttpResponse } from "msw";

initialize({ onUnhandledRequest: "bypass" }, [
  http.all("/api", () => HttpResponse.error()),
  http.all("/api/*", () => HttpResponse.error()),
]);
```

정상/HTTP 500 story 두 개와 exact `/api`·미정의 업무 경로·`/api/node_modules/sc-contract.js` 세 probe를 실제 확인했다. 미정의 요청 모두 fetch가 network error로 reject했고 로컬 HTTP 서버의 API 누출은 0이었다. 마지막 probe는 addon의 파일/Storybook URL 필터에 걸리는 형태의 업무 경로도 최종 handler로 막는지 확인한다. callback에서 Error를 throw하면 worker의 합성 HTTP 500 응답으로 바뀔 수 있으므로 단순 throw를 fetch reject와 동일하게 취급하지 않는다. [정적 브라우저 결과](../검증/004-storybook-browser.json)

빈 목록·지연·401/403·CSRF 갱신·409 revision 충돌·필드 오류의 완전한 폼/업무 시나리오는 아직 이 두 조회 story로 검증되지 않는다. 005의 폼·화면 패턴과 007~010의 해당 기능에 상태별 fixture·기능 테스트를 추가한다. 저장 전 입력을 자동 재조회로 덮어 쓰거나 충돌 시 삭제하지 않으며 서버의 권한·상태 전이 검사는 별도 통합 검증으로 유지한다.

## 기능·접근성 검증과 반응형

각 `play`는 `storybook/test`의 `within`, `userEvent`, `expect`로 실제 사용자 동작과 결과를 확인한다. 역할·label·접근성 이름을 먼저 사용하고, CSS 토큰 확인처럼 DOM 스타일 자체가 계약인 경우에만 필요한 요소의 computed style을 읽는다. 내부 Vuetify 클래스만 조회해 클릭 성공 여부를 판정하지 않는다.

| 현재 작성된 story                         | 코드에 포함된 확인                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 버튼 Default/Disabled/Busy                | 실행 횟수, disabled, aria-busy, 처리 중 접근성 이름, 반경                                       |
| 버튼 NativeForm/SubmitButton/BusyInForm   | 클릭·Enter·Space, 기본 button의 제출 없음, 명시 submit, 부모 폼 reset, busy일 때 실행/제출 차단 |
| 입력 Default/FieldError/Readonly/Disabled | 입력 미리보기, label, 오류 description, readonly 값 보존, disabled, 테두리·반경                 |
| 셸 Default/Keyboard                       | 현재 메뉴·navigate 결과, skip link→본문 포커스, 카드 스타일                                     |
| 셸 MobileNavigation/MobileLongKorean      | dialog 열기·초기 포커스·Tab 순환·Escape·포커스 복귀, 긴 한국어 header 높이 연동                 |
| 모의 조회 Loaded/RequestError             | 합성 자료 표시와 오류 alert                                                                     |
| 토큰 Colors/Responsive                    | 의미색 표시, 키보드 동작·포커스 스타일                                                          |

이 표는 **작성된 assertion의 범위**이며 실행 통과 목록이 아니다. 초기 실패와 수정 후 결과를 따로 기록한다. 폼의 reset 예제는 부모 fixture가 입력 ref를 초기화하는 계약이며 공통 필드가 업무 폼 전체를 자동 초기화한다는 의미가 아니다.

`preview.ts`의 `a11y: { test: "error" }`는 axe 위반이 story 테스트 실패로 이어지도록 한다. 실패를 없애기 위해 전역 `off/todo`로 바꾸지 않는다. 예외는 원인·해당 범위·수정 계획을 기록하고 기능상 필요한 제한만 검토한다. 자동 검사 외에 label·키보드·focus 이동·읽기 순서·새 색상 조합을 확인한다. [Storybook 접근성 테스트](https://storybook.js.org/docs/writing-tests/accessibility-testing)

viewport 설정은 모바일 `390×844`, 업무 단말 `1366×768`, 넓은 단말 `1920×1080`을 제공한다. 셸 모바일 stories는 390 viewport를 명시한다. 세 viewport 옵션이 존재한다고 모든 story가 세 크기에서 검증된 것은 아니다. 새 부품마다 줄바꿈·긴 한국어·가로 넘침·focus와 입력 보존이 필요한 폭을 지정한다. 셸은 768px 경계의 열림/닫힘 전환과 실제 앱의 좁게→넓게→좁게 이동도 관련 E2E에서 확인한다.

## 검증 단계와 명령

모든 명령은 `/Users/dk/Work/ScFramework`에서 실행한다. 아래 표는 각 검사의 의미이며 실제 실행 결과는 이어지는 기록과 구분한다.

| 단계                   | 명령/도구                                                   | 증명하는 내용과 한계                                                                         |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 재현 설치              | `npm ci`                                                    | manifest/lock으로 실제 설치; lock 편집만으로 대체하지 않음                                   |
| 형식·정적 검사         | `npm run format:check`, `npm run lint`, `npm run typecheck` | SFC·story·공개 타입의 정적 일치; 브라우저 동작 증명은 별도                                   |
| 공개 metadata          | `npm run ui:contracts:check`                                | imported props/events/slots/default와 snapshot의 drift 차단; Docs 화면·attrs 의미는 별도     |
| 공개 import 경계       | `npm run ui:boundaries:check`                               | 세 UI public exports 소비와 shared→apps 참조 제한                                            |
| 관련 단위 테스트       | `npm run test:unit`                                         | props/event/attrs 및 runtime의 관련 의미 검사                                                |
| 정적 Storybook         | `npm run build-storybook`                                   | 별도 `storybook-static` 산출물 생성; play·Controls 양방향 동작 통과는 별도                   |
| 기능·axe               | `npm run test:stories`                                      | Vitest addon의 실제 Chromium story 렌더·play·a11y 검사                                       |
| Docs/Controls 브라우저 | `node scripts/verify-storybook.mjs`                         | 빌드한 manager/Docs와 iframe의 공개 표·기본값·Controls 양방향/reset·API 격리·pageerror 확인  |
| 두 소비 앱             | `npm run build`, `scripts/build.sh`, `npm run test:e2e`     | 공개 UI가 앱/JAR에서 실제 소비됨; Storybook 자체만으로 앱의 세션·업무를 대체하지 않음        |
| 전체 시각 회귀         | 006의 baseline·비교·승인 절차                               | 이후 구축 대상; 현재 토큰 assertion이나 수동 screenshot을 전체 baseline 완료로 표시하지 않음 |

로컬 카탈로그는 `npm run storybook`으로 6006 포트에서 실행한다. 브라우저 provider는 기본 Chromium을 사용하고 필요하면 `CHROME_BIN`으로 실행 파일을 지정한다. 개인 설치 경로를 소스·CI 기본값에 하드코딩하지 않는다.

Vitest addon은 stories를 브라우저 테스트로 변환하므로 별도 Storybook manager 서버 없이 smoke/play 검증을 수행할 수 있다. 따라서 `test:stories` 통과만으로 정적 Docs·Controls·manager 표시까지 확인한 것으로 기록하지 않는다. [Storybook Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon)

현재 루트 `npm run verify`에는 공개 계약·import 경계 검사가 편입되어 있다. Storybook build/play와 정적 Docs/Controls는 별도 명령으로 실제 확인했다. 원격 CI와 Docker 실행은 아직 미확인으로 유지한다.

## 실제 검증 결과와 초기 실패

2026-10-06 신규 로컬 환경의 결과다. [003 통합 빌드](../검증/003-integration-build-final.log)의 프런트 단위 30개·서버 15개·두 새 JAR와 [JAR E2E 7개](../검증/003-e2e.log)도 연결하며 기존 WorkboardVue 검증과 합산하지 않는다.

| 실행·확인                      | 실제 결과                                                                                                             | 근거                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| clean lock 재생성·`npm ci`     | 단일 잠금 파일 복구와 재현 설치 성공                                                                                  | [clean staging lock](../검증/004-clean-lock-regenerate.log), [설치](../검증/004-npm-ci.log) |
| Catalog 최종 타입              | 종료 0                                                                                                                | [타입 검사](../검증/004-catalog-typecheck-final.log)                                        |
| `npm run build-storybook`      | 정적 카탈로그 생성 성공                                                                                               | [빌드](../검증/004-storybook-build.log)                                                     |
| `npm run test:stories`         | 5파일/22개 기능·axe 검사 통과                                                                                         | [최종 stories](../검증/004-storybook-tests-final.log)                                       |
| 정적 Docs/Controls/API         | 공개 Docs 3개·Controls 2개·필드 reset·미정의 API 3개 차단·HTTP 누출/pageerror 0·캡처 7개, index stories 22개/Docs 5개 | [브라우저 결과](../검증/004-storybook-browser.json)                                         |
| 계약·경계 gate의 negative 경로 | contract drift/private import 각각 종료 1로 차단, 임시 probe 제거                                                     | [gate 결과](../검증/004-contract-gates.json)                                                |
| 레퍼런스 보호·audit            | 실행 관련 149개 파일 변경 0, 취약점 0                                                                                 | [원본·audit](../검증/004-source-and-audit.json)                                             |

정적 Docs는 ScActionButton props/events/slots **6/1/1**, ScTextField **18/7/0**, ScAppShell **5/1/4**를 표시한다. 한국어 문자열 기본값을 읽을 수 있고 내부 Vuetify props가 섞이지 않으며 공통 입력/셸 ID 중복은 0이다. [버튼 계약 표](../검증/004-ScActionButton-contracts.png), [입력 계약 표](../검증/004-ScTextField-contracts.png), [셸 계약 표](../검증/004-ScAppShell-contracts.png), [입력 Controls](../검증/004-ScTextField-controls.png)를 보존한다. reset 확인은 ScTextField에 적용했으며 셸은 양방향 activeItem/navigate를 확인했다.

| 초기 실패                                  | 확인한 원인·수정                                                                                                               | 보존 기록                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| imported docgen/Docs 일부 props만 표시     | UI include·workspace root 기준 tsconfig·Vue compiler를 docgen 앞에 배치                                                        | [경로](../검증/003-storybook-docgen-path.log), [순서](../검증/003-storybook-docgen-order.log)                                                                                              |
| 설치 뒤 Storybook loader의 esbuild 없음    | Catalog `esbuild@0.28.1` 직접 의존성과 루트 override를 맞추고 기존 node_modules 영향 없는 clean staging에서 lock 재생성·npm ci | [빌드 최초 실패](../검증/004-storybook-build-missing-esbuild.log), [story 최초 실패](../검증/004-storybook-tests-missing-esbuild.log), [clean lock](../검증/004-clean-lock-regenerate.log) |
| `print.error()` 정책의 미정의 API 누출/404 | MSW 2.13 callback의 로그 전용 동작 확인 → initial API error fallback                                                           | [API 격리 실패](../검증/004-storybook-browser-api-isolation-initial.json)                                                                                                                  |
| Default play 입력이 중간에서 멈춤          | verifier가 manager tab을 먼저 눌러 focus를 빼앗음 → Default play 결과 대기 후 Controls 조작                                    | [포커스 간섭](../검증/004-storybook-browser-focus-interference.json), [이전 입력 실패](../검증/004-storybook-browser-controls-race.json)                                                   |
| optional category 타입                     | category를 빈 문자열 기준으로 처리하고 최종 Catalog 타입 재검증                                                                | [최종 타입](../검증/004-catalog-typecheck-final.log)                                                                                                                                       |

compiler의 decodeEntities 안내와 큰 docs chunk 안내는 비실패 메시지로 남긴다. 현재 검증은 선택된 stories·공개 Docs·Controls·API 격리와 두 앱의 관련 흐름이며 006의 전체 시각 baseline/원격 CI나 005의 고급 모듈 완료를 뜻하지 않는다.

- [x] 실제 공개 metadata·정적 Docs·기본값·내부 props 차단·고유 ID를 확인했다.
- [x] 입력 확정/label·셸 탐색의 Controls 양방향과 필드 reset을 확인했다.
- [x] 정상/500 합성 API와 미정의 API 3개 차단·HTTP 누출 0을 확인했다.
- [x] 최종 Catalog 타입과 22개 story 기능/a11y를 확인했다.
- [x] 실제 설치·gate negative 경로·원본 보호·audit와 초기 실패를 기록했다.
- [x] 003/004 마감 문서의 최종 형식 검사를 [004-docs-format.log](../검증/004-docs-format.log)로 확인했다. 진행 중인 005 source의 검증과 구분한다.

## 새 공통 컴포넌트의 정의 완료 조건

아래 항목은 새 부품을 카탈로그에 등록할 때 확인할 기준이며 현재 모두 실행 완료를 뜻하지 않는다.

- [ ] 공통화할 두 사용처와 책임을 설명하고 업무 폼·조회·권한·Router 상태를 UI 안에 넣지 않는다.
- [ ] Sc 파일/import·sc- template/CSS와 SFC 순서를 지키며 공개 Props/Emits/Slots·값 타입·JSDoc을 export한다.
- [ ] props의 필수 여부·기본값·readonly·disabled·busy·model·native form 계약을 실제 부품 책임에 맞게 정의한다.
- [ ] 지원 HTML/ARIA/data attrs, 전달 DOM, 예약 속성, 내부 Vuetify 속성 차단을 UI 공개 계약에 기록한다.
- [ ] CSF `component`를 실제 공개 부품으로 지정하고 docgen에서 imported 타입·defaults·events·slots가 추출된다.
- [ ] 자동 snapshot 대상에 추가하고 호환성을 검토한 뒤 snapshot·문서·stories·두 소비 예제를 함께 갱신한다.
- [ ] 정상·경계·오류·처리 중·비활성·읽기 전용 중 해당 부품에 의미 있는 상태를 실제 story로 작성한다.
- [ ] 입력/선택 부품의 Controls→canvas와 canvas→args→Controls 양방향 연결 및 reset을 확인한다.
- [ ] API 조립 예제는 합성 MSW·story별 runtime을 사용하고 미등록 업무 요청·이전 story 상태를 남기지 않는다.
- [ ] 키보드·label·error description·focus·긴 한국어·필요 viewport를 play와 실제 브라우저로 확인한다.
- [ ] axe의 error gate가 유지되고 위반·play 실패·콘솔 오류를 성공으로 처리하지 않는다.
- [ ] 설치·정적 검사·단위·Storybook build·play/a11y·Docs/Controls·소비 앱 결과 및 초기 실패/수정/미확인을 기록한다.

공개 prop 삭제·기본값 변경·event payload 변경·slot/attrs 의미 변경은 [공개 계약의 semver·폐기 정책](UI-공개계약.md)을 따른다. 005의 고급 폼·표/가상화·다이얼로그·차트·Excel·에디터·다국어, 006의 전체 시각 회귀, 011의 외부 package/생성기, 012의 운영/Compose는 해당 단계에서 실제 구현·검증한다.

## 다음 AI 작업에 전달할 질의

```text
/Users/dk/Work/ScFramework의 AGENTS.md, docs/질의/003-공통UI계약.md,
UI-공개계약.md, 004-Storybook.md와 실제 Catalog 소스를 읽고 004를 진행해줘.
Sc 이름과 Vue SFC template→script setup lang=ts→style을 유지해줘.
실제 공개 Props/Emits/Slots와 defaults를 vue-component-meta로 자동 추출하고,
docgen 전용 tsconfig의 UI 포함 범위·snapshot drift·공개 import 경계를 확인해줘.
story args와 컴포넌트 defaults를 구분하고 metadata 오류를 수동 argTypes로 감추지 마.
입력과 메뉴는 useArgs/updateArgs로 Controls와 canvas의 양방향 동작을 검증해줘.
MSW 합성 API와 story별 runtime만 사용하고 실제 계정·DB·secret·운영 세션을 복사하지 마.
play의 실제 사용자 결과와 axe error gate를 확인하며 실패/콘솔/예상 밖 API 요청을 기록해줘.
Storybook build, Vitest play/a11y, 정적 Docs/Controls 브라우저, 두 소비 앱/JAR 검증을 구분해줘.
조건부 기술 전체 구현과 Redis/JWT/SSO 제외를 유지해줘.
005의 고급 부품, 006 전체 시각 회귀, 011 배포/생성기, 012 운영 및 원격 CI/Docker를
이번 카탈로그 코드 작성만으로 완료 표시하지 마.
실제 명령·결과·최초 실패와 수정·남은 범위를 정리하고 확인한 항목만 완료 표시해줘.
```
