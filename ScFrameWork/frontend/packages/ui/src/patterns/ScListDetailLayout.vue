<template>
  <div
    v-bind="pickScHtmlAttrs(attrs)"
    class="sc-list-detail-layout"
    :class="{ 'sc-list-detail-layout--detail': detailVisible }"
  >
    <div v-if="$slots.header"><slot name="header" /></div>
    <div v-if="$slots.search"><slot name="search" /></div>
    <div v-if="$slots.toolbar"><slot name="toolbar" /></div>
    <div class="sc-list-detail-layout__columns">
      <section class="sc-list-detail-layout__list" :aria-label="listLabel">
        <slot name="list" />
      </section>
      <section class="sc-list-detail-layout__detail" :aria-label="detailLabel">
        <sc-action-button
          v-if="detailVisible"
          class="sc-list-detail-layout__back"
          variant="outlined"
          @click="emit('show-list')"
        >
          {{ backLabel }}
        </sc-action-button>
        <slot name="detail" />
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * header/search/toolbar와 list/detail slot을 배치한다. detailVisible은 CSS 클래스를 바꾸어 모바일에서 보일 영역을 선택한다.
 * 목록과 상세 slot 자체는 v-if로 제거하지 않으므로 모바일 전환 시 입력 컴포넌트가 다시 생성되지 않는다.
 */

/*
 * 목록 선택 ID와 뒤로 이동할 URL은 부모 화면의 Router 상태다. 이 부품은 화면 분할만 담당한다.
 *  show-list emit은 목록 표시 요청이며 실제 선택 해제와 미저장 변경 확인은 부모가 처리한다.
 *  slot별 접근성 이름은 props로 받아 한국어/영어를 공통 레이아웃에 하드코딩하지 않는다.
 */
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type {
  ScListDetailLayoutProps,
  ScListDetailLayoutEmits,
  ScListDetailLayoutSlots,
} from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScListDetailLayoutProps>(), {
  detailVisible: false,
  listLabel: "목록 영역",
  detailLabel: "상세 영역",
  backLabel: "목록으로",
});
const emit = defineEmits<ScListDetailLayoutEmits>();
defineSlots<ScListDetailLayoutSlots>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
@use "../tokens" with (
  $sc-emit-css: false
);
.sc-list-detail-layout {
  display: grid;
  gap: var(--sc-space-6);
  min-width: 0;
}
.sc-list-detail-layout__columns {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: var(--sc-space-6);
}
.sc-list-detail-layout__list,
.sc-list-detail-layout__detail {
  min-width: 0;
}
.sc-list-detail-layout__back {
  display: none;
  margin-bottom: var(--sc-space-4);
}
@media (max-width: calc(tokens.$sc-breakpoint-md - 1px)) {
  .sc-list-detail-layout__columns {
    grid-template-columns: minmax(0, 1fr);
  }
  .sc-list-detail-layout__detail {
    display: none;
  }
  .sc-list-detail-layout--detail .sc-list-detail-layout__list {
    display: none;
  }
  .sc-list-detail-layout--detail .sc-list-detail-layout__detail {
    display: block;
  }
  .sc-list-detail-layout__back {
    display: inline-flex;
  }
}
</style>
