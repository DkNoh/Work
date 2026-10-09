<template>
  <header v-bind="pickScHtmlAttrs(attrs)" class="sc-page-header">
    <div class="sc-page-header__text">
      <p v-if="eyebrow" class="sc-page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="sc-page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="sc-actions"><slot name="actions" /></div>
  </header>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 페이지의 h1 제목과 선택적인 eyebrow/subtitle, 우측 actions slot을 표시한다. 문구는 텍스트 보간으로 출력된다.
 */

/*
 * 제목과 화면 행동의 실제 내용은 부모 화면에서 전달한다. JSP include와 비슷한 배치 재사용이지만 slot 내용은 Vue의 반응형 화면 조각이다.
 *  defineProps/defineSlots는 입력 형태를 설명하고 useAttrs는 class/data 등 나머지 허용 DOM 속성을 받는다. 자체 공유 상태나 API 호출은 없다.
 */
import { useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScPageHeaderProps, ScPageHeaderSlots } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScPageHeaderProps>(), { subtitle: "", eyebrow: "" });
defineSlots<ScPageHeaderSlots>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.sc-page-header__text {
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: var(--sc-font-size-title);
  line-height: var(--sc-line-height-title);
  overflow-wrap: anywhere;
}
.sc-page-header__eyebrow {
  color: var(--sc-color-primary);
  font-size: var(--sc-font-size-small);
  font-weight: 700;
  margin-bottom: var(--sc-space-2);
}
.sc-page-header__subtitle {
  margin-top: var(--sc-space-2);
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}
</style>
