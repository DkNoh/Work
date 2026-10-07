<template>
  <article class="sc-design-tokens sc-stack" aria-label="디자인 토큰 사용 가이드">
    <header class="sc-stack sc-design-tokens__intro">
      <p class="sc-design-tokens__eyebrow">ScFramework · 디자인 기반</p>
      <h1>업무 화면의 공통 디자인 토큰</h1>
      <p>
        한국어 업무 화면의 읽기 쉬운 밀도를 기준으로 색상·간격·글꼴을 선택합니다.
        <code>ui/src/tokens.ts</code>
        를 수정하면 CSS, Vuetify 테마, 이 가이드가 같은 값을 사용합니다.
      </p>
    </header>

    <section v-if="show('colors')" class="sc-stack" aria-labelledby="tokens-colors-heading">
      <h2 id="tokens-colors-heading">색상은 표시 목적에 맞게 선택</h2>
      <p>상태에는 이름과 설명을 함께 표시합니다. 보조색 위의 글자는 on-secondary를 사용합니다.</p>
      <ul class="sc-design-tokens__palette">
        <li v-for="item in colorExamples" :key="item.background" class="sc-design-tokens__swatch">
          <div :style="{ backgroundColor: color[item.background], color: color[item.foreground] }">
            <strong>{{ item.label }}</strong>
            <span>{{ color[item.background] }}</span>
            <span>{{ item.background }} / {{ item.foreground }}</span>
          </div>
        </li>
      </ul>
      <dl class="sc-design-tokens__color-values">
        <div v-for="(value, key) in color" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <p class="sc-design-tokens__note">
        surface · {{ color.surface }} / background · {{ color.background }} / text ·
        {{ color.text }}
      </p>
    </section>

    <section v-if="show('spacing')" class="sc-stack" aria-labelledby="tokens-spacing-heading">
      <h2 id="tokens-spacing-heading">4px 단위의 간격</h2>
      <p>
        입력 간격은 16px, 카드 간격과 데스크톱 본문 여백은 24px, 작은 화면 여백은 16px를 기본으로
        사용합니다.
      </p>
      <ul class="sc-design-tokens__spaces">
        <li v-for="(value, key) in uiTokens.space" :key="key">
          <code>--sc-space-{{ key }}</code>
          <span aria-hidden="true" :style="{ width: `${value}px` }" />
          <strong>{{ value }}px</strong>
        </li>
      </ul>
    </section>

    <section v-if="show('typography')" class="sc-stack" aria-labelledby="tokens-type-heading">
      <h2 id="tokens-type-heading">한국어 시스템 글꼴과 정보 계층</h2>
      <p>
        브라우저의 기본 확대를 허용합니다. 긴 제목은 줄바꿈하고 placeholder와 별도로 label을
        제공합니다.
      </p>
      <ul class="sc-design-tokens__type">
        <li v-for="(value, key) in uiTokens.fontSize" :key="key">
          <code>{{ key }} · {{ value }}px</code>
          <p :style="{ fontSize: `${value}px` }">
            업무 정보를 명확하게 읽고 필요한 동작을 선택합니다.
          </p>
        </li>
      </ul>
      <p>본문 line-height {{ uiTokens.lineHeight.body }}, 제목 {{ uiTokens.lineHeight.title }}</p>
      <p class="sc-design-tokens__note">{{ uiTokens.fontFamily }}</p>
    </section>

    <section v-if="show('shape')" class="sc-stack" aria-labelledby="tokens-shape-heading">
      <h2 id="tokens-shape-heading">반경과 그림자로 영역 구분</h2>
      <div class="sc-design-tokens__shapes">
        <div
          v-for="(value, key) in uiTokens.radius"
          :key="key"
          :style="{ borderRadius: `${value}px` }"
        >
          <strong>{{ key }} · {{ value }}px</strong>
          <span>{{ radiusUsage[key] }}</span>
        </div>
      </div>
      <div class="sc-design-tokens__shapes">
        <div v-for="(value, key) in uiTokens.shadow" :key="key" :style="{ boxShadow: value }">
          <strong>{{ key }}</strong>
          <code>{{ value }}</code>
        </div>
      </div>
    </section>

    <section v-if="show('responsive')" class="sc-stack" aria-labelledby="tokens-responsive-heading">
      <h2 id="tokens-responsive-heading">반응형과 키보드 사용</h2>
      <p>
        768px 미만은 메뉴 drawer와 한 열, 768~1199px는 업무별 두 열, 1200px 이상은 읽기 좋은 본문
        폭을 사용합니다.
      </p>
      <dl class="sc-design-tokens__breakpoints">
        <div v-for="(value, key) in uiTokens.breakpoint" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ value }}px</dd>
        </div>
      </dl>
      <p>
        헤더 {{ uiTokens.layout.headerHeight }}px · 탐색 {{ uiTokens.layout.sidebarWidth }}px · 최대
        본문 {{ uiTokens.layout.contentWidth }}px
      </p>
      <p>
        Tab으로 다음 버튼과 입력으로 이동하세요. 운영체제의 동작 줄이기를 선택하면 전환과 반복
        애니메이션을 최소화합니다.
      </p>
      <div class="sc-actions">
        <sc-action-button @click="focusCount += 1">포커스 확인</sc-action-button>
        <span role="status">선택 {{ focusCount }}회</span>
      </div>
      <sc-text-field v-model="sampleTitle" label="긴 한국어 업무 제목" />
    </section>
  </article>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ScActionButton, ScTextField, uiTokens } from "@sc/ui";

type Section = "colors" | "spacing" | "typography" | "shape" | "responsive";
const props = withDefaults(defineProps<{ section?: Section | "all" }>(), { section: "all" });
const color = uiTokens.color;
const focusCount = ref(0);
const sampleTitle = ref("업무 제목이 길어져도 입력값과 조작 이름을 유지합니다");
const radiusUsage = { sm: "버튼·입력", md: "영역 카드", lg: "대화상자" };
const colorExamples: {
  label: string;
  background: keyof typeof color;
  foreground: keyof typeof color;
}[] = [
  { label: "주요 행동", background: "primary", foreground: "onPrimary" },
  { label: "보조 강조", background: "secondary", foreground: "onSecondary" },
  { label: "선택한 항목", background: "selected", foreground: "onSelected" },
  { label: "처리 완료", background: "success", foreground: "onSuccess" },
  { label: "확인 필요", background: "warning", foreground: "onWarning" },
  { label: "처리 오류", background: "error", foreground: "onError" },
  { label: "안내", background: "info", foreground: "onInfo" },
  { label: "업무 탐색", background: "navBackground", foreground: "navText" },
];
function show(section: Section) {
  return props.section === "all" || props.section === section;
}
</script>

<style scoped lang="scss">
.sc-design-tokens {
  gap: var(--sc-space-10);
  h2 {
    font-size: var(--sc-font-size-section);
  }
  p {
    margin: 0;
  }
  code {
    overflow-wrap: anywhere;
  }
}
.sc-design-tokens__intro {
  gap: var(--sc-space-3);
}
.sc-design-tokens__eyebrow {
  font-size: var(--sc-font-size-small);
  font-weight: var(--sc-font-weight-semibold);
  color: var(--sc-color-text-muted);
}
.sc-design-tokens__palette {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-4);
  padding: 0;
  list-style: none;
}
.sc-design-tokens__swatch > div {
  display: flex;
  flex-direction: column;
  gap: var(--sc-space-2);
  min-height: 136px;
  padding: var(--sc-space-4);
  border-radius: var(--sc-radius-md);
}
.sc-design-tokens__color-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-3);
  margin: 0;
}
.sc-design-tokens__color-values > div {
  display: flex;
  justify-content: space-between;
  gap: var(--sc-space-2);
  padding: var(--sc-space-3);
  border-bottom: 1px solid var(--sc-color-border);
}
.sc-design-tokens__color-values dd {
  margin: 0;
}
.sc-design-tokens__swatch span {
  overflow-wrap: anywhere;
}
.sc-design-tokens__note {
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}
.sc-design-tokens__spaces {
  padding: var(--sc-space-4);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface);
  list-style: none;
}
.sc-design-tokens__spaces li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-4);
  padding-block: var(--sc-space-2);
}
.sc-design-tokens__spaces code {
  width: 120px;
}
.sc-design-tokens__spaces span {
  display: block;
  height: var(--sc-space-5);
  background: var(--sc-color-primary);
  border-radius: var(--sc-radius-sm);
}
.sc-design-tokens__type {
  display: flex;
  flex-direction: column;
  gap: var(--sc-space-6);
  list-style: none;
  padding: 0;
}
.sc-design-tokens__type p {
  margin-block-start: var(--sc-space-2);
  overflow-wrap: anywhere;
}
.sc-design-tokens__shapes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-6);
}
.sc-design-tokens__shapes > div {
  display: flex;
  flex-direction: column;
  gap: var(--sc-space-3);
  min-height: 100px;
  padding: var(--sc-space-4);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface);
}
.sc-design-tokens__breakpoints {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
  margin: 0;
}
.sc-design-tokens__breakpoints > div {
  min-width: 76px;
  padding: var(--sc-space-3);
  background: var(--sc-color-surface);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-sm);
}
.sc-design-tokens__breakpoints dt {
  font-weight: var(--sc-font-weight-semibold);
}
.sc-design-tokens__breakpoints dd {
  margin: 0;
}
</style>
