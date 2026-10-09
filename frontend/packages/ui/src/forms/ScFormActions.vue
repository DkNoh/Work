<template>
  <div v-bind="actionAttrs()" class="sc-form-actions" :aria-busy="busy || undefined">
    <div v-if="$slots.notice" class="sc-form-actions__notice"><slot name="notice" /></div>
    <div class="sc-form-actions__buttons">
      <slot name="secondary" />
      <sc-action-button
        v-if="showCancel"
        type="button"
        variant="outlined"
        :disabled="disabled || busy"
        @click="cancelForm"
      >
        {{ cancelLabel }}
      </sc-action-button>
      <sc-action-button
        type="submit"
        :form="form"
        :disabled="disabled"
        :busy="busy"
        :busy-label="busyLabel"
      >
        {{ submitLabel }}
      </sc-action-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 안내 slot·추가 행동 slot·취소·저장 버튼을 배치한다. 저장 버튼은 type=submit으로 실제 form의 제출 절차에 참여한다.
 * form prop이 있으면 폼 바깥의 버튼도 해당 ID의 form에 연결된다.
 */

/*
 * 버튼 배치와 busy/disabled 표시만 담당한다. 입력 검증·API 저장·저장 후 이동은 부모 form의 submit 처리에 있다.
 *  notice/secondary slot은 부모가 화면 조각을 넣는 자리다. emit cancel은 취소 의도만 알리며 입력 초기화를 대신하지 않는다.
 */
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScFormActionsProps, ScFormActionsEmits, ScFormActionsSlots } from "./form-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScFormActionsProps>(), {
  busy: false,
  disabled: false,
  submitLabel: "저장",
  cancelLabel: "취소",
  busyLabel: "저장 중…",
  showCancel: true,
});
const emit = defineEmits<ScFormActionsEmits>();
defineSlots<ScFormActionsSlots>();
const attrs = useAttrs();

// aria-busy는 busy prop과 일치하도록 자체 설정하고 나머지 허용 DOM 속성만 전달한다.
function actionAttrs() {
  return pickScHtmlAttrs(attrs, {
    attributes: ["id"],
    omit: ["aria-busy"],
  });
}
// 처리 중이거나 비활성일 때 취소 이벤트도 막아 중복 동작을 줄인다.
function cancelForm(event: MouseEvent) {
  if (!props.disabled && !props.busy) emit("cancel", event);
}
</script>

<style scoped lang="scss">
.sc-form-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--sc-space-4);
  padding-block: var(--sc-space-4);
  border-top: 1px solid var(--sc-color-border);
}

.sc-form-actions__notice {
  min-width: 0;
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}

.sc-form-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--sc-space-2);
  margin-left: auto;
}
</style>
