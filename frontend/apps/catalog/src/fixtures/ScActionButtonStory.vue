<template>
  <section class="sc-stack" aria-label="동작 버튼 예제">
    <div>
      <sc-action-button v-bind="buttonProps" :aria-label="buttonLabel" @click="executeAction">
        <template v-if="!props.iconOnly">저장</template>
      </sc-action-button>
    </div>
    <p role="status" aria-label="버튼 실행 횟수">실행 {{ count }}회</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Controls에서 받은 공개 버튼 props를 전달하고 실제 click emit 횟수를 status에 표시한다. iconOnly일 때는 글자 slot을 생략한다.
 */

/*
 * Story 전용 buttonLabel과 라이브러리 props를 구분하는 wrapper다. 교차 타입 &는 ScActionButtonProps에 fixture 설정을 더한다.
 *  computed는 buttonLabel을 제거한 새 props 객체를 만들고 count ref는 사용자가 실제 실행한 결과만 표시한다.
 */
import { computed, ref } from "vue";
import { ScActionButton, type ScActionButtonProps } from "@sc/ui";

const props = defineProps<ScActionButtonProps & { buttonLabel?: string }>();
const buttonProps = computed(() => {
  const button = { ...props };
  delete button.buttonLabel;
  return button;
});
const count = ref(0);
// 이 카운터는 click 이벤트가 전달됐는지 확인하는 합성 결과다. 운영 저장이나 API 호출을 대신하지 않는다.
function executeAction() {
  count.value += 1;
}
</script>
