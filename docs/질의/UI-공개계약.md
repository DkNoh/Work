# Sc UI 공개 계약

## 현재 공개 계약: 013 공통 디자인 규격25개

현재 공개 UI는25개다. 버튼·입력·카드·KPI·상태 배지·표의 반복 표현을 아래 공개 prop으로 제공하고 Reference·Starter·생성 앱·Storybook에서 같은 부품을 소비한다. [013 공통 디자인 규격과 사용 예제](013-공통디자인프레임워크.md), [현재 계약 snapshot](../ui-contracts.json), [실제 검증 집계](../검증/013-common-ui-summary.json)가 현재 기준이다. 아래005의20개·81Story와010의22개 기록은 당시 결과로 보존한다.

| 부품                           | 추가 공개 계약                                                                                           | 실제 기본값·규칙                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ScActionButton`               | `size: ScActionButtonSize`, `intent: ScActionButtonIntent`, `iconPath?:string`, `iconOnly?:boolean`      | `size='md'`, `intent='primary'`, `iconOnly=false`; `color` 미지정일 때 intent 사용                       |
| `ScTextField`/`ScTextArea`     | `density: ScControlDensity`                                                                              | `comfortable`; `compact`는 같은 모델·오류·readonly 계약으로 밀도만 선택                                  |
| `ScSelect`                     | `density: ScControlDensity`, `presentation:'field'\|'toolbar'`, `tone:'surface'\|'primary'\|'secondary'` | `comfortable/field/surface`; tone은 toolbar에만 적용                                                     |
| `ScSectionCard`                | `density: ScCardDensity`, `surface: ScSectionCardSurface`                                                | `comfortable/bordered`; compact 제목15.2px·헤더16px·본문8/16/16px, plain은 구분선 생략                   |
| `ScKpiCard`                    | `density: ScCardDensity`                                                                                 | `comfortable`; 값24px/compact22px, 공통 gap16px·padding16px·최소높이128px, 앱이 업무 숫자·추세 문구 소유 |
| `ScStatusBadge`                | `label:string` 필수, `tone: ScStatusBadgeTone`                                                           | `tone='neutral'`; events/slots 없음, 색 외에 실제 문구로 상태 제공                                       |
| `ScDataTable`/`ScVirtualTable` | `density:'comfortable'\|'compact'`, `captionVisibility:'visible'\|'sr-only'`, `minTableWidth:number`     | `comfortable/visible/0`; caption을 접근성 읽기 순서에 유지                                               |

`ScActionButtonSize`는 `sm/md/lg`이며 높이32/38/44px·아이콘·여백을 함께 선택한다. `ScActionButtonIntent`는 `primary/secondary/success/warning/danger/neutral`이다. 기존 `color`를 명시하면 intent보다 우선한다. 임의 Vuetify size/icon/loading prop을 attrs로 전달하여 공개 규격을 우회하지 않는다.

`iconPath`는 장식 SVG path이며 `aria-hidden` 처리한다. `iconOnly=true`는 아이콘과 비어 있지 않은 `aria-label` 또는 `title`이 필수다. title만 제공하면 접근성 이름으로 연결하며 누락은 명시적으로 거절한다. busy 중에는 기존 busyLabel이 처리 상태의 이름을 제공한다. slot 안에 직접 아이콘을 그리는 기존 버튼 계약도 유지한다.

`ScControlDensity`와 `ScCardDensity`는 `comfortable/compact`다. `ScSectionCardSurface`는 `bordered/plain`이다. `ScStatusBadgeTone`은 `neutral/primary/secondary/success/warning/danger/info`다. 배지는 허용 HTML/ARIA/data 속성을 전달하되 `role`, `aria-live/atomic/relevant`를 차단하여 정적 상태 문구를 자동 알림 영역으로 바꾸지 않는다. 이름·aria-labelledby가 필요한 카드의 내부 제목 참조는 기존 계약을 유지한다.

카드의 현재 표현은 위 표를 따른다. `ScKpiCard`의 `tone`은 `green/violet/pink/amber` 중 하나다. 두 density에서 같은 `uiTokens.color.accentGreenSoft/accentVioletSoft/accentPinkSoft/accentAmberSoft` 배경과 `color.text` 아이콘 색을 사용한다. 아이콘은 36×40px, 지표 이름은 13px, 지표 값은 600 굵기다. density는 값의 크기를 선택하며 tone·업무 의미를 바꾸지 않는다. 아이콘과 배경 장식은 `aria-hidden`이고 카드 이름은 실제 제목과 연결한다. 숫자 형식·증감의 완결된 문구·설명은 앱이 전달하며 긴 문구는 줄바꿈한다. Storybook `FourMetrics`는 네 tone을 유지하고 density Controls를 네 카드에 함께 적용한다.

`ScSectionCard`의 compact 제목은 `uiTokens.fontSize.cardTitle`(15.2px)·600 굵기를 사용한다. `surface='plain'`은 카드와 헤더의 구분선만 생략하며 배경·그림자·제목의 접근성 참조와 `default/actions` slots를 유지한다. 위 값은 현재 소스의 규격이다. 005/013 당시 검증 기록은 당시 소스의 결과로 보존하며 이번 수정의 실행 결과로 합산하지 않는다.

toolbar `ScSelect`는 native select와 화면에서 숨긴 label을 연결한다. 오류·hint는 aria-describedby로 연결하고 disabled는 폼 제출에서 제외한다. readonly는 선택 편집을 차단하되 name/form 값을 hidden input으로 제출한다. clearable을 제공할 때만 null 선택을 허용한다. 일반 field 표현은 기존 Vuetify·v-model·options/오류 계약을 유지한다.

색·padding·font 등의 반복 시각 규칙은 토큰과 공개 prop을 사용한다. 업무 열 너비·콘텐츠 배치의 기능별 scoped CSS는 유지할 수 있다. 모든 native 요소나 `:deep`을 일괄 금지하지 않는다. 버전·default·props/events/slots·metadata·Storybook Controls는 함께 검증하며 정식 승격 시 새 minor 버전을 고정한다. 현재0.3.0 산출물은 미게시 검토 후보이고 이전 불변 아카이브를 덮어쓰지 않는다.

## 이전 단계의 기본 계약과 검증 기록

003에서 확정한 기본 계약에 005의 입력·화면 패턴·표·확장 모듈을 추가한 공개 계약 문서다. **003/004/005 구현·로컬 검증을 완료**했으며 [003 기록](003-공통UI계약.md)·[004 기록](004-Storybook.md)·[005 기록](005-공통입력과화면패턴.md)에서 각 단계의 실제 결과를 구분한다. 005는 20개 공개 UI·81개 Story·20 공개 UI Docs/8 Controls·두 앱 새 JAR E2E 18개를 확인했다. 이 문서는 앱과 카탈로그가 사용하는 이름·타입·상태·이벤트·slot·속성 전달의 기준이며 011의 외부 패키지 배포 완료를 뜻하지 않는다.

## 공개 진입점

| 진입점          | 공개 대상                                                                                                               | 소비 규칙                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@sc/ui`        | 기본 버튼/입력/셸, ScSelect/Checkbox/TextArea·FormActions/ConfirmDialog·화면 패턴/KPI/상태 배지, 공개 타입·theme·tokens | Vue/TypeScript에서 이름으로 import한다. `src/` 파일 경로를 직접 참조하지 않는다.                    |
| `@sc/ui/styles` | 공통 CSS 토큰·본문·카드·focus·reduced motion 스타일                                                                     | 앱 entry와 Storybook preview에서 Vuetify 스타일 뒤에 한 번 import한다.                              |
| `@sc/ui/tokens` | 생성된 Sass breakpoint와 CSS 방출 설정                                                                                  | SFC의 media query는 이 공개 Sass 진입점을 사용한다. CSS 중복 방출은 `$sc-emit-css: false`로 막는다. |
| `@sc/ui/table`  | ScDataTable·ScVirtualTable·ScVirtualList·자체 표/선택/가상화 공개 타입                                                  | 해당 기능을 사용할 때 subpath를 명시한다. TanStack 전체 옵션/renderer를 전달하지 않는다.            |
| `@sc/ui/charts` | ScChart·ScSeriesChart·자체 data/series/상태/select 계약                                                                 | ECharts 옵션·인스턴스를 public props로 노출하지 않는다.                                             |
| `@sc/ui/editor` | ScRichTextEditor·자체 JSON 타입·schema/link validator                                                                   | Tiptap 전체 타입/extension·HTML model을 공개하지 않는다.                                            |
| `@sc/ui/board`  | ScSortableBoard·자체 readonly column/item·move·labels·slot 타입                                                         | dnd-kit 옵션과 업무 상태·권한·revision은 공개 props로 전달하지 않는다.                              |
| `@sc/ui/image`  | ScImageAnnotator·normalized box/annotation·labels 타입·isNormalizedBox                                                  | decode 완료 HTMLImageElement와 자체 좌표만 전달한다. HTTP·파일·EXIF 처리는 앱이 소유한다.           |

005의 상세 타입·기본값·접근성/native form·기능 검증은 [입력·폼 계약](005-입력폼계약.md), [표·가상화 계약](005-표가상화계약.md), [차트·에디터·Excel·다국어 계약](005-확장모듈계약.md)에 있다. `@sc/excel`과 `@sc/i18n`은 UI와 분리된 중립 패키지다. 세 하위 문서의 focused 기록을 보존하며 전체 통합 결과는 005 main에서 별도로 확인한다.

010의 두 공개 subpath·props/defaults/events/slots·readonly·keyboard/pointer·좌표·이미지/EXIF 책임과 실제 사용처는 [보드·이미지 계약](010-보드와이미지계약.md)을 따른다. 010 당시22개 공개 계약 생성 확인·통합 재검증 진행 중 기록은 해당 단계에서 보존하며 현재25개 계약의 실제 실행 결과는013을 따른다. 위005의20개 UI 완료 기록도 당시 결과다.

자동 [UI snapshot](../ui-contracts.json)은 format 2다. 각 prop의 `defaultSpecified:false`는 기본값 미기재이며 이때의 `default:null`은 JSON 저장 표현이다. `defaultSpecified:true, default:null`은 명시한 null 기본값이다. 실제 ScSelect.modelValue는 전자, ScDataTable.sorting은 후자다. Docs도 두 경우를 구분한다. generic metadata의 object/unknown 표시는 타입 제약으로 특수화될 수 있으므로 이 JSON이 모든 generic 소비 타입을 그대로 전개한 결과라고 해석하지 않는다.

경계 checker는 앱→공통 private 경로·공통→앱·앱→다른 앱·공통→다른 공통 private 경로를 차단하고 같은 패키지 내부 상대/alias import는 허용한다. 실제 manifest의 공개 exports를 사용하며 `--root <임시 fixture>`와 계약 checker의 `--snapshot <임시 JSON>`은 격리된 실패 검증용 입력이다. 005의 실제 578 imports·20 계약 통과와 별개로 006의 [실제 CLI 실패 gate](../검증/006-framework-gates.json)는 24 cases/165 보호 파일·변경 0·cleanup을 확인했다. 현재 checker는 literal TS import/export/dynamic import와 SCSS @use/@forward 검사이며 계산형 dynamic import·CJS require·Sass @import·복수 Vue script·tsconfig alias 전체 resolver까지 보장하지 않는다. 011의 실제 Node exports/peer·외부 설치 검증은 별도로 수행한다.

`ScShellNavigation`은 셸 내부 부품이다. 앱은 `ScAppShell`의 메뉴 자료·이벤트로 사용하며 내부 탐색 부품·helper·Vuetify DOM 구조를 공개 API로 취급하지 않는다. 현재 workspace의 source exports와 private package는 개발 소비 방식이다. npm `pack`·dist·외부 설치·빈 경로 생성 검증은 011에서 수행한다.

```ts
// 소비 앱의 main.ts
import { createApp } from "vue";
import { createScVuetify } from "@sc/ui";
import "vuetify/styles";
import "@sc/ui/styles";
import App from "./App.vue";

createApp(App).use(createScVuetify()).mount("#app");
```

`createScVuetify()`의 install은 앱의 `config.idPrefix`가 비어 있으면 모듈 내 증가값으로 `sc-1`, `sc-2`와 같은 prefix를 부여한다. 소비자가 이미 지정한 prefix는 유지한다. 동일 UI bundle을 공유하는 여러 CSR Vue 앱·Autodocs 예제가 같은 DOM에 있어도 `useId()`로 생성하는 입력·label·설명 ID를 구분한다. 직접 `id`를 지정할 때는 소비자가 같은 문서 안의 고유성을 보장한다. Vue의 prefix 설정은 [app.config.idPrefix](https://vuejs.org/api/application.html#app-config-idprefix)를 따른다.

여러 독립 UI bundle은 증가값을 공유하지 않으므로 소비자가 앱마다 고유한 `app.config.idPrefix`를 `app.use(createScVuetify())` 전에 지정한다. 현재 자동 증가 정책의 대상은 CSR이며 SSR·hydration 지원은 구현·검증되지 않았다. SSR에 그대로 적용해 서버/클라이언트 ID 일치를 보장한다고 해석하지 않는다.

```scss
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);

@media (max-width: tokens.$sc-breakpoint-sm - 1px) {
  .project-summary {
    display: block;
  }
}
```

공통 UI 파일/import는 `ScActionButton`, Vue template tag는 `<sc-action-button>`, CSS는 `.sc-*`다. Props는 camelCase로 정의하고 template에서는 kebab-case로 전달한다. 공개 이벤트와 named slot은 단일 단어 또는 kebab-case이며 Vue의 `modelValue`/`update:modelValue`는 그대로 유지한다.

## ScActionButton

공개 타입은 `ScActionButtonProps`, `ScActionButtonEmits`, `ScActionButtonSlots`, `ScActionButtonType`, `ScActionButtonVariant`, `ScActionButtonSize`, `ScActionButtonIntent`다. 버튼은 실제 button 동작을 유지하며 저장 함수를 소유하지 않는다.

| prop        | 타입                                        | 필수·기본값        | 의미                                                                  |
| ----------- | ------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `busy`      | `boolean`                                   | 선택, `false`      | 처리 중 표시. 실제 버튼을 disabled로 만들어 추가 실행을 막는다.       |
| `busyLabel` | `string`                                    | 선택, `"처리 중…"` | 처리 중 이름과 loader의 접근성 설명                                   |
| `disabled`  | `boolean`                                   | 선택, `false`      | 사용 불가. busy와 별개로 앱의 사용 가능 상태를 받는다.                |
| `type`      | `"button" \| "submit" \| "reset"`           | 선택, `"button"`   | native button/form 의미. 제출 또는 native reset은 앱이 명시한다.      |
| `color`     | `string`                                    | 선택, 미지정       | 명시하면 intent보다 우선. 앱이 사용자 지정 색 조합의 대비를 확인한다. |
| `variant`   | `"flat" \| "text" \| "outlined" \| "tonal"` | 선택, `"flat"`     | 공개 버튼 표현                                                        |

| 이벤트·slot    | payload      | 계약                                                                                                                                                         |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `click`        | `MouseEvent` | 실행 가능한 클릭만 전달한다. busy/disabled와 같은 렌더 주기의 연속 클릭/재진입에서는 emit과 native 기본 동작을 차단한다. 앱은 기존 `@click` 사용을 유지한다. |
| `default` slot | 없음         | 버튼 이름/내용. busy가 아니면 이 내용을 표시하며 busy에서는 busyLabel과 loader를 표시한다.                                                                   |

`type="submit"` 버튼의 저장 동작은 form의 submit handler에 둔다. 버튼 click과 form submit에 같은 저장 함수를 동시에 연결해 두 번 실행하지 않는다. `type="reset"`은 브라우저의 native reset이며 VeeValidate/ref의 상태를 자동으로 reset한다는 뜻이 아니다. 제어되는 Vue 폼의 reset은 앱이 form reset handler와 `resetForm` 등으로 연결한다.

`id`, `name`, `value`, `form`, `autofocus`와 `formaction`/`formenctype`/`formmethod`/`formnovalidate`/`formtarget`은 native 버튼 속성으로 연결한다. `form`은 버튼이 form 바깥에 있을 때도 해당 form ID를 가리킬 수 있다. focus/blur/keydown/keyup의 지원 DOM listener는 실제 버튼으로 전달한다. 버튼을 링크로 바꾸는 `href`·`to`·`tag`, 내부 busy를 우회하는 `loading`, 임의 Vuetify prop은 공개 속성이 아니다. 렌더 주기의 클릭 제한은 앱의 저장 중 guard·서버 권한/revision 검증을 대체하지 않는다.

## ScTextField

공개 타입은 `ScTextFieldProps`, `ScTextFieldEmits`, `ScTextFieldSlots`, `ScTextFieldType`, `ScTextFieldInputMode`다. `modelValue`는 항상 문자열이다. `number`·날짜 관련 type도 공통 입력에서 숫자/Date로 자동 변환하지 않으며 업무 schema가 해석한다.

| prop                      | 타입                          | 필수·기본값        | 의미                                                                                                             |
| ------------------------- | ----------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `modelValue`              | `string`                      | 필수               | 앱/폼이 소유한 입력. template에서는 `v-model`을 사용한다.                                                        |
| `label`                   | `string`                      | 필수               | 눈에 보이는 필드 label. placeholder로 대체하지 않는다.                                                           |
| `id`                      | `string`                      | 선택, 자동 고유 ID | 실제 입력과 label/오류·설명을 연결하는 ID                                                                        |
| `errorMessages`           | `string \| readonly string[]` | 선택, `""`         | 폼/schema/API가 판단한 오류 메시지. 비어 있지 않은 문자열을 모두 표시한다.                                       |
| `hint`                    | `string`                      | 선택, `""`         | 입력 방법을 설명하는 문구                                                                                        |
| `required`                | `boolean`                     | 선택, `false`      | native 필수 입력 의미. 서버/Zod 검증을 대체하지 않는다.                                                          |
| `disabled`                | `boolean`                     | 선택, `false`      | 조작·focus·native form 제출 대상에서 제외                                                                        |
| `readonly`                | `boolean`                     | 선택, `false`      | 사용자는 읽기/focus 가능, 입력 변경은 불가. native form에서는 값을 제출한다.                                     |
| `type`                    | `ScTextFieldType`             | 선택, `"text"`     | `text`, `password`, `email`, `search`, `tel`, `url`, `number`, `date`, `datetime-local`, `time`, `month`, `week` |
| `name`                    | `string`                      | 선택, 미지정       | native form의 필드 이름                                                                                          |
| `autocomplete`            | `string`                      | 선택, 미지정       | username/current-password 등 브라우저 자동 완성 의미                                                             |
| `form`                    | `string`                      | 선택, 미지정       | 실제 입력과 연결할 form ID                                                                                       |
| `placeholder`             | `string`                      | 선택, 미지정       | 입력 예. label·필수 설명·오류를 대체하지 않는다.                                                                 |
| `maxLength` / `minLength` | `number`                      | 선택, 미지정       | native 문자열 길이 제약. template 속성은 `max-length` / `min-length`                                             |
| `pattern`                 | `string`                      | 선택, 미지정       | 해당 native 입력 type의 pattern 제약                                                                             |
| `inputMode`               | `ScTextFieldInputMode`        | 선택, 미지정       | `none`, `text`, `decimal`, `numeric`, `tel`, `search`, `email`, `url` 입력 키보드 힌트                           |
| `autofocus`               | `boolean`                     | 선택, `false`      | 브라우저 자동 focus. 여러 부품에 동시에 지정하지 않는다.                                                         |

| 이벤트              | payload         | 계약                                                                                                                   |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `update:modelValue` | `string`        | 입력 변경을 앱/폼에 전달한다. disabled/readonly에서는 전달하지 않는다. 부모의 props 갱신은 반영한다.                   |
| `focus` / `blur`    | `FocusEvent`    | 앱에서 touched/focus 관련 동작이 필요할 때 연결한다.                                                                   |
| `keydown` / `keyup` | `KeyboardEvent` | 앱의 키보드 동작 연결. 업무 저장 handler를 공통 입력에 넣지 않는다.                                                    |
| `input` / `change`  | `Event`         | 입력 동작이 가능한 경우의 이벤트. disabled/readonly에서는 전달하지 않는다. 같은 값을 따로 입력 상태에 복사하지 않는다. |

공개 slot은 없다. Vuetify의 append/prepend/details 등 내부 slot을 무제한 전달하지 않는다. 새로운 조립 요구는 공개 prop/slot의 책임을 정한 뒤 추가한다.

label ID와 오류·hint ID 연결은 입력 부품이 관리한다. 앱이 `aria-describedby`로 외부 설명을 지정하면 표시 중인 오류/hint ID와 병합한다. 현재 hint는 focus 중 표시하며 오류는 오류 목록이 있을 때 표시한다. `aria-labelledby`를 지정해도 기존 label 연결을 유지한다. 오류는 `message.length > 0`인 모든 문자열을 표시하고 `""`만 제외하며 원본 readonly 배열을 수정하지 않는다. 공백 문자열을 trim해서 제거하는 계약은 아니다. 내부 `max-errors`를 실제 오류 개수로 설정하여 여러 메시지를 같은 설명 DOM에 모두 표시한다. `maxErrors`는 별도의 공개 prop/attrs가 아니다. `errorMessages`를 표시한다고 form의 오류 상태를 이 부품 안에 따로 복제하지 않는다.

입력의 native 역할은 `type`으로 정의한다. 검색 입력은 `type="search"`를 사용한다. Field의 `role` attrs는 Vuetify wrapper와 input에 중복 전달되는 것을 막기 위해 제외하며, 앱이 wrapper까지 textbox/searchbox로 바꾸지 않는다.

다음 예제의 폼 상태·업무 schema는 소비 앱에 있다. 저장 동작은 부모의 `save` 처리로 연결하고 공통 입력/버튼은 상태와 이벤트만 전달한다.

```vue
<template>
  <form id="example-form" class="sc-stack" novalidate @submit.prevent="submitExample">
    <p id="example-title-help">업무에서 정한 제목을 입력하세요.</p>
    <sc-text-field
      v-model="title"
      label="제목"
      name="title"
      :error-messages="form.errors.value.title"
      :disabled="saving"
      :max-length="200"
      aria-describedby="example-title-help"
      required
    />
    <sc-action-button type="submit" :busy="saving" busy-label="저장 중…">저장</sc-action-button>
  </form>
</template>

<script setup lang="ts">
import { useForm } from "vee-validate";
import { z } from "zod";
import { ScActionButton, ScTextField } from "@sc/ui";

const props = withDefaults(defineProps<{ saving?: boolean }>(), { saving: false });
const emit = defineEmits<{ save: [input: { title: string }] }>();
const titleSchema = z.object({ title: z.string().trim().min(1).max(200) });
const form = useForm<{ title: string }>({ initialValues: { title: "" } });
const [title] = form.defineField("title");

function submitExample() {
  if (props.saving) return;
  form.setErrors({ title: undefined });
  const result = titleSchema.safeParse(form.values);
  if (!result.success) {
    form.setFieldError("title", result.error.issues[0]?.message);
    return;
  }
  emit("save", result.data);
}
</script>
```

이 예제는 form에 `novalidate`를 지정해 Zod/VeeValidate가 제출 오류를 표시한다. native 브라우저 제약을 함께 쓸지는 업무 폼이 정한다. 어느 경우든 서버 validation을 유지한다.

## HTML·ARIA·data 속성의 공개 경계

`ScHtmlAttrs`는 props 이외에 허용하는 공통 HTML/ARIA/data 속성의 공개 타입이다. 임의 속성을 `$attrs` 전체로 Vuetify에 넘기지 않고 허용 목록을 사용한다. 지원하지 않는 Vuetify prop이나 callback은 전달하지 않는다. attrs의 전달 위치는 부품마다 다르다.

005에서 공통 `ScHtmlAttrs.id?:string`을 추가했다. 실제 외부 container ID가 필요한 패턴/차트·셸·폼 행동은 해당 DOM에 전달한다. ScTextField/Select/Checkbox/TextArea/ConfirmDialog/RichTextEditor처럼 공개 id prop을 가진 부품은 그 prop으로 실제 입력/dialog ID를 관리한다. 자체 label·설명·main/dialog의 생성 ID를 root attrs로 덮어쓰지 않는다.

| 속성·이벤트                                  | ScActionButton                                                                                                  | ScTextField                                                                            | ScAppShell                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`, `style`                             | 실제 button                                                                                                     | 입력의 바깥 Vuetify wrapper                                                            | 실제 `.sc-app-shell` div                                                                                                                                |
| `data-*`                                     | 실제 button                                                                                                     | 바깥 wrapper                                                                           | 실제 `.sc-app-shell` div                                                                                                                                |
| `title`, `lang`, `dir`, `tabindex`, `aria-*` | 실제 button, 아래 예약 항목 제외                                                                                | 실제 input, 아래 예약/병합 항목 제외                                                   | 실제 `.sc-app-shell` div                                                                                                                                |
| `role`                                       | 실제 button                                                                                                     | 전달하지 않음. `type`으로 native 입력 의미를 지정                                      | 실제 `.sc-app-shell` div                                                                                                                                |
| `id`                                         | 실제 button                                                                                                     | `id` prop으로 입력 ID 지정                                                             | 실제 `.sc-app-shell` div만. 내부 main/dialog 고유 ID를 바꾸지 않음                                                                                      |
| 추가 root HTML 속성                          | 없음                                                                                                            | 없음                                                                                   | `accesskey`, `autocapitalize`, `autocorrect`, `contenteditable`, `draggable`, `enterkeyhint`, `hidden`, `inert`, `inputmode`, `spellcheck`, `translate` |
| native form 속성                             | `name`, `value`, `form`, `autofocus`, `formaction`, `formenctype`, `formmethod`, `formnovalidate`, `formtarget` | 공개 name/autocomplete/form/길이/pattern/inputMode/autofocus props로 실제 input에 전달 | 없음                                                                                                                                                    |
| DOM 이벤트                                   | 공개 `click` emit, attrs의 focus/blur/keydown/keyup listener                                                    | 공개 model/focus/blur/keydown/keyup/input/change emit                                  | root div의 click/dblclick/auxclick/contextmenu/focus/blur/focusin/focusout/keydown/keyup 및 각 capture listener                                         |

예약 항목은 속성으로 덮어쓰지 않는다.

- 버튼의 `type`·`disabled`·`busy`는 props가 소유한다. attrs의 `aria-busy`·`aria-disabled`는 전달하지 않으며 `aria-busy`는 busy에서 계산한다.
- 입력의 `id`는 prop이 소유한다. attrs의 `role`은 제외하며 `aria-invalid`·`aria-required`·`aria-disabled`·`aria-readonly`는 전달하지 않고 error/required/disabled/readonly에서 계산한다. 외부 `aria-describedby`·`aria-labelledby`는 내부 설명/label ID를 유지하면서 병합한다.
- 셸의 menu/dialog 열림 상태·내부 ID·navigate는 셸 계약이 소유한다. root div의 속성으로 내부 navigation/main/dialog을 다시 정의하지 않는다.

`href`, `to`, `tag`, `loading`, `density`, `theme` 등 임의 Vuetify prop은 공통 HTML attrs가 아니다. 필요한 상태는 공개 prop으로 전달한다. HTML의 모든 속성·모든 Vuetify 기능을 지원한다고 해석하지 않는다. 새 속성이 필요한 경우 전달 DOM과 접근성/form 영향을 먼저 정해 계약·타입·테스트·문서를 함께 추가한다.

## ScAppShell

공개 타입은 `ScAppShellProps`, `ScAppShellEmits`, `ScAppShellSlots`, `ScAppShellNavItem`, `ScAppShellLabels`다. `navigationItems`와 항목의 `id`·`label`·`href`는 읽기 전용이다. 셸은 메뉴 배열을 수정하거나 Router를 만들지 않는다.

| prop               | 타입                           | 필수·기본값         | 의미                                                                                                                    |
| ------------------ | ------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `applicationTitle` | `string`                       | 필수                | header와 모바일 탐색의 앱 제목                                                                                          |
| `applicationLabel` | `string`                       | 선택, `""`          | header의 보조 설명. 빈 값이면 표시하지 않는다.                                                                          |
| `navigationLabel`  | `string`                       | 선택, `"화면 탐색"` | desktop nav와 모바일 dialog/nav의 접근성 이름                                                                           |
| `navigationItems`  | `readonly ScAppShellNavItem[]` | 필수                | 앱이 소유하는 메뉴. 각 항목은 고유 `id`, 화면 이름 `label`, 이동할 `href`를 갖는다.                                     |
| `activeItem`       | `string`                       | 필수                | 현재 Router에서 계산한 메뉴 ID. 일치하는 항목의 링크에 `aria-current="page"`를 표시한다.                                |
| `labels`           | `Partial<ScAppShellLabels>`    | 선택, `{}`          | `skipContent/openNavigation/closeNavigation` 부분 재정의. 생략 문구는 `본문으로 이동`·`탐색 메뉴 열기`·`탐색 메뉴 닫기` |

locale의 원본은 앱의 `@sc/i18n` 인스턴스다. `common.shell.skipToContent`를 `labels.skipContent`에, 나머지 openNavigation/closeNavigation 메시지를 같은 이름의 label에 연결한다. 셸은 Vue I18n/저장소를 직접 import하지 않는다. `createScVuetify({locale?,fallback?})`의 두 옵션은 각각 `'ko'|'en'`, 기본값은 각각 `'ko'`이며 양 언어의 Vuetify 메시지를 포함한다. 앱의 locale 전환은 소비 App.vue에서 Vuetify current/document.lang에 연결한다.

| 이벤트     | payload             | 발생·소비 계약                                                                                                                                                                                                                          |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate` | `ScAppShellNavItem` | 일반 왼쪽 클릭·Enter의 링크 선택을 앱에 전달한다. 앱은 Router에 연결한다. 모바일 탐색은 닫힌다. Ctrl/Meta/Shift/Alt 등 수정 키·보조 버튼의 링크 선택은 브라우저 기본 동작을 유지한다. 이미 defaultPrevented인 이벤트는 전달하지 않는다. |

| slot             | payload | 위치·책임                                                                                    |
| ---------------- | ------- | -------------------------------------------------------------------------------------------- |
| `default`        | 없음    | 단일 `main` 안의 업무 페이지. 앱은 `section`·한 개의 `h1`·폼을 넣는다.                       |
| `header-actions` | 없음    | 앱별 계정 표시·로그아웃·화면 행동. 인증 동작은 앱/runtime에 둔다.                            |
| `notice`         | 없음    | `main` 위쪽의 앱 알림. 앱이 `role="alert"`/`status`와 내용을 정한다.                         |
| `sidebar-footer` | 없음    | **desktop sidebar 아래**의 설명. 좁은 화면에서 반드시 필요한 행동은 이 slot에만 넣지 않는다. |

본문 skiplink·단일 main·고유 main/dialog ID·현재 링크·모바일 native dialog·Escape/Tab·닫은 뒤 focus 복귀는 셸이 제공한다. `navigationOpen`과 header 높이 측정은 셸 내부 UI 상태이며 앱의 현재 페이지·폼 상태와 별개다. 긴 header의 실제 높이는 ResizeObserver가 측정하고 listener/Observer는 셸이 해제한다. 모바일/desktop 전환의 숨겨진 탐색으로 focus가 남지 않도록 조정한다.

모바일에서 메뉴를 연 뒤 다른 메뉴를 선택하면 `navigate`를 앱에 전달하고 dialog를 닫는다. URL 변경·이동 가드·미저장 입력 확인은 Router를 소유한 앱이 처리한다. 셸은 메뉴를 보고 권한을 판단하거나 저장되지 않은 폼을 초기화하지 않는다.

```vue
<template>
  <sc-app-shell
    application-title="업무 프로젝트"
    application-label="내부 업무"
    navigation-label="업무 화면"
    :navigation-items="navigationItems"
    :active-item="activeItem"
    @navigate="navigateToPage"
  >
    <template #header-actions>
      <slot name="account-actions" />
    </template>
    <template #sidebar-footer>현재 프로젝트의 업무 화면입니다.</template>
    <router-view />
  </sc-app-shell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ScAppShell, type ScAppShellNavItem } from "@sc/ui";

const route = useRoute();
const router = useRouter();
const navigationItems: readonly ScAppShellNavItem[] = [
  { id: "examples", label: "예제 목록", href: "/examples" },
];
const activeItem = computed(() => (typeof route.name === "string" ? route.name : ""));

async function navigateToPage(item: ScAppShellNavItem) {
  await router.push(item.href);
}
</script>
```

## 005 화면 패턴 7개

원본은 [patterns/contracts.ts](../../frontend/packages/ui/src/patterns/contracts.ts)와 각 SFC이며 `@sc/ui`에서 이름으로 export한다. named/default slot의 payload는 없고 VNode[]를 받는다. 패턴은 폼 값·API·Query·상세 ID를 소유하지 않는다.

| 부품                 | Props와 실제 기본값                                                                               | Events / slots                                                 | DOM·행동                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ScPageHeader`       | `title:string` 필수, `subtitle=''`, `eyebrow=''`                                                  | events 없음, `actions` slot                                    | 실제 header·h1. 페이지에서 한 번 배치하며 긴 문구/행동 줄바꿈                                                |
| `ScSectionCard`      | `title:string` 필수, `description=''`                                                             | events 없음, `default/actions` slots                           | 실제 section·h2. 자체 heading ID를 aria-labelledby로 연결                                                    |
| `ScSearchPanel`      | `label='검색'`, `submitLabel='검색'`, `resetLabel='초기화'`, `disabled=false`                     | `submit(SubmitEvent)`, `reset(Event)`; `default/actions` slots | 실제 form·fieldset·legend. native submit/reset을 prevent 후 활성 상태에서 emit. 앱이 검색 확정/폼 reset 실행 |
| `ScErrorPanel`       | `message:string` 필수, `title='조회하지 못했습니다'`, `retryLabel='다시 조회'`, `showRetry=true`  | `retry()`; slots 없음                                          | div role=alert·h2/message·선택 retry 버튼. 조회 함수는 앱이 연결                                             |
| `ScEmptyState`       | `title='표시할 자료가 없습니다'`, `message=''`                                                    | events 없음, `actions` slot                                    | div role=status. 빈 조회/안내와 앱 행동                                                                      |
| `ScLoadingState`     | `label='자료 불러오는 중…'`                                                                       | events/slots 없음                                              | div role=status·aria-live=polite·aria-busy=true. 시각 spinner는 aria-hidden                                  |
| `ScListDetailLayout` | `detailVisible=false`, `listLabel='목록 영역'`, `detailLabel='상세 영역'`, `backLabel='목록으로'` | `show-list()`; `header/search/toolbar/list/detail` slots       | 바깥 div·이름 있는 목록/상세 section. 1200px 미만에서 선택 영역만 표시하며 두 slot을 mounted 상태로 유지     |

공통 허용 HTML/ARIA/data는 위 표의 바깥 DOM으로 전달하고 attrs의 임의 Vuetify prop/callback을 제외한다. SearchPanel의 aria-label, SectionCard의 aria-labelledby, Error/Empty의 role, Loading의 role/aria-live/busy는 내부 의미를 유지한다. 검색 default slot에 form을 중첩하지 않는다. `actions` slot을 바꾸면 custom 버튼의 submit/reset type·disabled/권한은 소비 앱이 연결한다.

ListDetailLayout의 모바일 `show-list`는 실제 선택 해제/URL 변경/미저장 판단을 대신하지 않는다. 앱이 결과를 처리하며 표시 전환 때문에 입력 component를 다시 mount하지 않는다. 같은 의미의 `ScDialog`·`ScFormField`를 이름만 다른 wrapper로 만들지 않고 기존 입력과 [ScConfirmDialog/ScFormActions](005-입력폼계약.md)를 조립한다.

## 공통 UI와 앱의 책임

| 책임                        | 원본·소유 위치                                  | UI 부품의 역할                                                            |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| 현재 페이지·상세/편집 ID    | 앱의 Vue Router                                 | 셸의 `activeItem`과 링크 선택 이벤트만 연결                               |
| 서버 목록·상세·저장 후 갱신 | 업무별 Vue Query key/API                        | 받은 자료와 loading/empty/error를 표시                                    |
| 저장 전 입력·필드 오류      | 앱의 VeeValidate 폼 문맥 또는 로컬 ref/reactive | `v-model`, label, 오류·설명, readonly/disabled 연결                       |
| 업무 입력 규칙              | 기능 폴더의 Zod schema·서버 validation          | 필드 오류를 읽기 쉽게 표시. schema를 공통 입력에 하드코딩하지 않음        |
| 세션·CSRF·공통 HTTP 오류    | runtime의 단일 client·auth·session              | 앱이 공급한 상태를 표시. 별도 HTTP client를 만들지 않음                   |
| 권한·상태 전이·revision     | 소비 앱의 Service/API와 기능 폴더               | 버튼 표시로 서버 권한 검사를 대체하지 않음                                |
| busy·미저장·409             | 동작/입력을 소유한 앱·폼                        | busy·disabled를 표시하고 받은 입력을 유지. 자동 저장·form reset 하지 않음 |
| 테마·색·간격·반응형         | UI `tokens.ts`·생성 Sass·Vuetify theme          | 같은 토큰으로 앱과 카탈로그를 표시                                        |

계산 가능한 값은 computed로 만들고 입력을 Pinia와 VeeValidate에 이중 저장하지 않는다. disabled와 readonly는 저장 여부·권한을 판단하는 상태가 아니며 서버가 최종 검증한다. 응답 409가 와도 앱은 입력을 reset하지 않고 명시적인 최신 내용 불러오기/취소에서 변경한다.

005에서 두 앱에 독립 Vue I18n·공통/앱 메시지·한국어 fallback과 셸/공통 예제의 한영 전환을 구현했다. 앱이 label props·Vuetify current/document.lang을 연결하며 locale 변경으로 DTO·Query·폼 입력을 복사하거나 초기화하지 않는다. 기존 Examples의 업무 본문 문구와 추가 업무 번역은 해당 features가 소유한다. 전체 앱/JAR 전환 검증은 [005 기록](005-공통입력과화면패턴.md)에 확정한다. [조건부 기술 전체 구현](조건부기술-전체구현.md)의 모든 대상은 필수 구현 범위이며 소비 앱 활성화만 선택 가능하다. Redis·JWT·SSO 제외는 유지한다.

## 변경·폐기 정책

공개 타입·prop 기본값·event payload·slot·허용 속성·폼/접근성 동작·공개 export와 `--sc-*` 토큰 이름의 변경은 소비 앱에 미치는 영향을 함께 검토한다. 내부 helper와 Vuetify DOM selector는 공개 사용 경로가 아니다.

| 변경                                                                         | 처리 기준                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공개 동작을 유지하는 오류 수정·문서 수정                                     | patch 변경으로 기록하고 관련 회귀를 확인한다.                                                                                                                                            |
| 선택 prop·새 named slot·새 공개 부품을 호환 가능한 방식으로 추가             | minor 변경으로 기록한다. 기존 기본 동작을 바꾸지 않는다.                                                                                                                                 |
| 필수 prop 추가·이름/타입/default/event 변경·slot 제거·공개 token/export 제거 | breaking 변경이다. 안정판 1.x 이후에는 major로 올리고 이전/새 사용 예제·이행 방법을 제공한다.                                                                                            |
| 기존 이름 폐기                                                               | 곧바로 삭제하지 않는다. `@deprecated`, 대체 이름·이유·제거 예정 버전, changelog와 문서/Storybook을 함께 갱신한다. 안정판은 적어도 한 minor에서 이행 경로를 제공한 뒤 major에서 제거한다. |

현재 `0.1.0`은 workspace 내 개발 버전이다. 안정판 전 breaking 변경도 변경 기록과 이행 예제를 남기고 0.x minor를 올리는 기준으로 관리한다. 의존성은 정확한 버전과 단일 lock으로 관리한다. 버전 정책을 적었다고 외부 배포·업그레이드 검증을 완료한 것으로 표시하지 않는다.

변경 시 공개 type·실제 SFC·두 앱 사용처·Storybook args/문서·기능/a11y·UI 계약 문서를 같이 확인한다. 앱은 Vuetify의 임의 prop이나 `src/` import를 우회 경로로 추가하지 않고 필요한 공통 계약을 먼저 정한다. 각 단계의 통합 결과를 [003](003-공통UI계약.md)·[005](005-공통입력과화면패턴.md)에 남기고 006의 회귀와 011의 외부 설치 완료를 구분한다.
