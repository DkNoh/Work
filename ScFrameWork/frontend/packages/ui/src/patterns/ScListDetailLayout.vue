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
