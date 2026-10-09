<template>
  <span
    v-bind="pickScHtmlAttrs(attrs, { omit: ['role', 'aria-live', 'aria-atomic', 'aria-relevant'] })"
    class="sc-status-badge"
    :data-tone="tone"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 현재 상태를 짧은 label과 tone으로 보여 주는 span이다. 색을 보지 못해도 label로 상태를 알 수 있다.
 */

/*
 * 업무 상태 코드에서 label/tone을 결정하는 것은 소비 앱 책임이다. 공통 배지는 상태 전이를 실행하지 않는다.
 *  정적 상태 표시는 alert/status live region과 다르므로 role/aria-live 관련 attrs를 제외해 표의 배지가 매번 자동 낭독되지 않게 한다.
 */
import { useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScStatusBadgeProps, ScStatusBadgeSlots } from "./contracts";

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScStatusBadgeProps>(), { tone: "neutral" });
defineSlots<ScStatusBadgeSlots>();
const attrs = useAttrs();
</script>

<style scoped lang="scss">
.sc-status-badge {
  --sc-badge-tone: var(--sc-color-text-muted);
  --sc-badge-foreground: var(--sc-badge-tone);
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: calc(var(--sc-space-1) / 2) var(--sc-space-2);
  border-radius: var(--sc-radius-sm);
  color: var(--sc-badge-foreground);
  background: color-mix(in srgb, var(--sc-badge-tone) 8%, var(--sc-color-surface));
  font-size: var(--sc-font-size-small);
  font-weight: var(--sc-font-weight-semibold);
  line-height: var(--sc-line-height-body);
  overflow-wrap: anywhere;

  &[data-tone="primary"] {
    --sc-badge-tone: var(--sc-color-primary);
  }
  &[data-tone="secondary"] {
    --sc-badge-tone: var(--sc-color-secondary);
    --sc-badge-foreground: var(--sc-color-on-secondary);
  }
  &[data-tone="success"] {
    --sc-badge-tone: var(--sc-color-success);
  }
  &[data-tone="warning"] {
    --sc-badge-tone: var(--sc-color-warning);
  }
  &[data-tone="danger"] {
    --sc-badge-tone: var(--sc-color-error);
  }
  &[data-tone="info"] {
    --sc-badge-tone: var(--sc-color-info);
  }
}
</style>
