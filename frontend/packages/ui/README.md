# @sc/ui

Vue 3 공통 UI의 ESM·타입 선언·CSS·Sass 토큰 패키지다. 업무 API, 권한, Router, 서버 Query, 입력 저장과 revision은 소비 앱이 소유한다. Vue SFC template에서 `sc-*` 태그를 사용한다.

현재 공통 프런트 source 버전은 `0.3.0`이고 서버 cohort는 `0.3.0-SNAPSHOT`이다. 이전 `0.1.0`·`0.2.0` 후보와 검증·실패 증거는 보존한다. 013 공통 디자인 규격·Reference/Starter·Storybook·별도 후보·독립 설치 소비 앱의 실제 브라우저까지 로컬 검증을 완료했다. 기존 아카이브의 성적을 새 source 검증에 합산하지 않는다. 현재18082 서버는 유지한다. 이번0.3.0 산출물은 미게시 검토 후보이며 정식 승격 시 새 minor 버전을 고정한다. 기준·실제 결과는 저장소의 `docs/질의/013-공통디자인프레임워크.md`를 따른다.

## 공개 진입점

| 경로            | 역할                                                        |
| --------------- | ----------------------------------------------------------- |
| `@sc/ui`        | 버튼·입력·폼·상태·화면 shell, `createScVuetify`, `uiTokens` |
| `@sc/ui/table`  | 일반 표·가상 표·가상 목록과 자체 계약                       |
| `@sc/ui/charts` | 차트와 자체 자료·선택 계약                                  |
| `@sc/ui/editor` | 리치 텍스트 JSON 편집과 자체 계약                           |
| `@sc/ui/board`  | 읽기 전용 열/항목과 명시 이동 의도의 보드                   |
| `@sc/ui/image`  | decoded 이미지와 원본 0~1 좌표 주석                         |
| `@sc/ui/styles` | 전체 공통·scoped 스타일을 포함한 단일 CSS                   |
| `@sc/ui/tokens` | Sass 토큰. JS import 경로가 아니다                          |

JS는 `dist/*.js`, 선언은 `dist/types`, 계약 metadata는 `dist/CONTRACTS.json`에 있다. `./src/*`·private helper·dist wildcard를 공개하지 않는다. 선택 진입점은 기본 JS graph를 분리하지만 현재 한 manifest에 선택 dependency도 있으므로 설치 비용까지 제거하지 않는다.

## 공통 디자인 선택

| 부품                           | 공개 prop                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `ScActionButton`               | `size="sm/md/lg"`, `intent="primary/secondary/success/warning/danger/neutral"`, `variant`, `icon-path`, `icon-only` |
| `ScTextField`/`ScTextArea`     | `density="comfortable/compact"`                                                                                     |
| `ScSelect`                     | `density`, `presentation="field/toolbar"`, toolbar의 `tone="surface/primary/secondary"`                             |
| `ScSectionCard`                | `density="comfortable/compact"`, `surface="bordered/plain"`                                                         |
| `ScKpiCard`                    | `density="comfortable/compact"`                                                                                     |
| `ScStatusBadge`                | `label`, `tone="neutral/primary/secondary/success/warning/danger/info"`                                             |
| `ScDataTable`/`ScVirtualTable` | `density="comfortable/compact"`, `caption-visibility="visible/sr-only"`, `min-table-width`(숫자, 기본0)             |

표의 슬래시는 선택 가능한 값의 설명이며 실제 prop에는 한 값만 전달한다. 기본값은 기존 comfortable·bordered·field 표현을 보존한다. 새 버튼은 의미별 `intent`를 먼저 사용하며 기존 `color`를 명시하면 intent보다 우선한다. 아이콘 전용 버튼은 `icon-path`와 비어 있지 않은 `aria-label` 또는 `title`이 필요하다. 상태 배지는 정적 텍스트이며 `role="status"`나 live announcement를 만들지 않는다.

## 소비 앱 설정

Vue/Vuetify peer는 package.json의 exact 버전을 사용한다. 소비 앱의 main 모듈에서 스타일 순서를 지정하고 같은 Vue 앱에 theme을 설치한다.

```ts
import "vuetify/styles";
import "@sc/ui/styles";
import { createApp } from "vue";
import { createScVuetify } from "@sc/ui";
import App from "./App.vue";

createApp(App)
  .use(createScVuetify({ locale: "ko" }))
  .mount("#app");
```

```vue
<template>
  <v-app>
    <sc-section-card title="로컬 입력" density="compact" surface="plain">
      <sc-text-field v-model="title" label="제목" density="compact" />
      <sc-status-badge label="작성 중" tone="info" />
      <sc-action-button size="sm" intent="primary" @click="saveDraft">저장</sc-action-button>
    </sc-section-card>
  </v-app>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { VApp } from "vuetify/components";
import { ScActionButton, ScSectionCard, ScStatusBadge, ScTextField } from "@sc/ui";
const title = ref("");
function saveDraft() {
  // 실제 저장·필드 오류·409 입력 보존은 소비 앱이 구현한다.
}
</script>
```

소비 SFC의 Sass는 `@use '@sc/ui/tokens' with ($sc-emit-css: false)`로 breakpoint 값을 가져온다. native Sass CLI에서 bare package를 해석하려면 별도의 NodePackageImporter와 `pkg:@sc/ui/tokens` 설정이 필요하다. 토큰을 consumer 설치 중 다시 생성하지 않는다.

```scss
@use "pkg:@sc/ui/tokens" as tokens with (
  $sc-emit-css: false
);
.consumer-panel {
  min-width: tokens.$sc-breakpoint-sm;
}
```

위 native Sass 예제는 `sass-embedded`의 `new NodePackageImporter(consumerRoot)`를 importer로 전달한다. 실제 외부 소비에서 `768px` 출력과 `:root` 미방출을 확인했다. Vite SFC의 bare `@sc/ui/tokens` 해석과 같은 설정으로 취급하지 않는다.

## generic 표 타입 사용

```vue
<template>
  <sc-data-table :rows="rows" :columns="columns" caption="샘플 목록" :get-row-key="getRowKey">
    <template #cell="{ row }">{{ row.amount }}</template>
  </sc-data-table>
</template>
<script setup lang="ts">
import { ScDataTable, type ScTableColumn } from "@sc/ui/table";
type Row = { id: string; amount: number };
const rows: readonly Row[] = [{ id: "first", amount: 1 }];
const columns: readonly ScTableColumn<Row>[] = [
  { id: "amount", label: "수량", value: (row) => row.amount },
];
const getRowKey = (row: Row) => row.id;
</script>
```

row/item generic은 자체 Props·Slots·value 함수까지 유지한다. 잘못된 row 필드, 문자열 model에 숫자 전달, 잘못된 native click event 타입은 실제 외부 tsc/vue-tsc negative에서 거절했다. vendor whole options를 공개 prop으로 넘기거나 `@sc/ui/src/contracts`·`@sc/ui/dist/index.js`를 import해 계약을 우회하지 않는다. 두 private 경로는 실제 `ERR_PACKAGE_PATH_NOT_EXPORTED`로 거절된다.

## 범위·배포 정책

브라우저 CSR/bundler용이다. Vuetify CSS·DOM·canvas를 일반 Node에서 직접 import하거나 SSR/native canvas adapter를 제공하는 패키지로 해석하지 않는다. 부모의 props/배열은 읽기 전용이며 상태 변경은 model/명시 이벤트로 전달한다. 일반 표 대안·키보드 동선·이미지 decode/EXIF·HTTP·세션 전환은 각 공개 계약과 앱 책임을 따른다.

### 타입 검사 지원 경계

UI 생산 설정은 `strict:true`, `skipLibCheck:true`다. 자체 SFC·공개 Props/Emits/Slots·generic 소비 코드를 검사하되 vendor의 선언 파일 자체 검사는 생략한다. UI를 제외한 date/excel/i18n/runtime 패키지는 생산 선언 생성에서 `skipLibCheck:false`를 사용한다.

UI 최초 `skipLibCheck:false` 빌드는 자체 source 오류 0, upstream 선언 오류 697개로 실패했다. VueKonva의 전역 PrefixedKonvaComponents와 Vuetify component 이름 충돌, Vuetify의 `Animation.finished`와 TypeScript DOM 선언의 optional/readonly 불일치, Vuetify util의 중복 `Slot` export가 원인이다. 이 과정의 전체 로그는 저장소 `docs/검증/011-library-ui-initial.log`에 보존한다. vendor 파일 patch·임의 any·private import로 고치지 않는다. 외부 소비에서도 `skipLibCheck:false`의 모든 vendor 오류가 0인 조합을 지원한다고 주장하지 않으며, 별도 실제 strict probe의 결과는 011 검증 문서에서 확인한다.

실제 외부 strict-vendor probe는 exit2·696개(Vuetify695·TypeScript libDOM1), TS2344/TS2687/TS2308·자체 source0이었다. 최초 producer697개와 다른 실행/참조 graph이므로 숫자를 바꾸지 않는다. 지원 설정 `strict:true/skipLibCheck:true`에서 공개 타입·SFC positive와 잘못된 prop/model/emit/generic slot·Identity/decoder·private type의 기대 실패를 확인했다. 다른4 패키지의 별도 외부 `skipLibCheck:false`는 실제 exit0이다.

검증 근거는 ScFramework 저장소의 `docs/검증/011-consumer-types-second.json`이다. source alias0인 보존된 `0.1.0` 외부 소비에서 native4·타입12·private3·XLSX/Sass를 확인한 결과이며, 이후 `0.2.0`·`0.3.0` source의 검증과 구분한다. UI는 위 native4 Node smoke의 대상이 아니다.

소비 화면의 읽기 전용 JSON 미리보기가 스크롤되면 키보드 접근도 제공한다. 실제 template/두 앱의 `<pre>`에 `tabindex="0"`, `role="region"`, locale에 따른 고유 이름을 추가했고 기존 `[tabindex]:focus-visible` 토큰을 재사용했다. 이 변경은 공통 에디터 내부 옵션 변경이 아니다. 3SFC scoped lint·template SHA를 확인한 뒤 새 `0.1.0` 후보4에서 실제 focus/ArrowDown 스크롤과 브라우저7그룹·whole-DOM axe4회 violations/중복ID0을 확인했다. 근거는 `docs/검증/011-generated-fourth/summary.json`이며 이후 버전의 upgrade/rollback 성공이나 013 검증으로 합산하지 않는다.

워크스페이스 개발 빌드는 루트 도구로 수행하며 완성한 tarball을 소비한다. 설치 시 prepare/postinstall로 소스를 빌드하지 않는다. 버전 stamp는 `dist/build-manifest.json`에 있다. tarball에는 테스트·Story·앱 DTO·실행 자료·source map을 포함하지 않는다. 외부 설치/브라우저 검증 결과는 프로젝트의 011 검증 문서와 구분해 확인한다.

자체 코드는 `private:true`·`UNLICENSED`다. `UNLICENSED`와 `THIRD_PARTY_NOTICES`를 보존한다. NOTICE는 실제 직접 runtime dependency/peer의 원본 라이선스·고지를 재현한다. vendor JS는 외부화하며 transitive npm 패키지의 원래 고지도 별도로 적용된다. ECharts의 Apache-2.0을 자체 코드의 라이선스로 바꾸지 않는다.
