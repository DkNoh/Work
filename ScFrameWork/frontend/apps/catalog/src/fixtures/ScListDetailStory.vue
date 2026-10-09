<template>
  <sc-list-detail-layout
    v-bind="props"
    :detail-visible="detailVisible"
    @show-list="selectDetail(false)"
  >
    <template #list>
      <sc-section-card title="목록">
        <sc-action-button @click="selectDetail(true)">예제 선택</sc-action-button>
      </sc-section-card>
    </template>
    <template #detail>
      <sc-section-card title="선택 상세">
        <sc-text-field v-model="draft" label="작성 중인 상세" />
      </sc-section-card>
    </template>
  </sc-list-detail-layout>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * list/detail named slot에 선택 버튼과 작성 중인 입력을 배치한다. 목록으로 돌아가도 draft가 남는지 확인할 수 있다.
 */

/*
 * detailVisible ref는 이 예제의 표시 선택이고 실제 앱의 상세 ID/URL과는 별개다. 공통 레이아웃의 show-list를 부모가 처리하는 흐름을 보여 준다.
 *  Controls의 detailVisible은 watch로 받고, 입력 draft는 별도 ref로 유지해 모바일 표시 전환과 생명주기를 구분한다.
 */
import { ref, watch } from "vue";
import {
  ScListDetailLayout,
  ScSectionCard,
  ScTextField,
  ScActionButton,
  type ScListDetailLayoutProps,
} from "@sc/ui";
const props = defineProps<ScListDetailLayoutProps>();
const emit = defineEmits<{ "update:detailVisible": [value: boolean] }>();
const draft = ref("");
const detailVisible = ref(props.detailVisible ?? false);
watch(
  () => props.detailVisible,
  (value) => (detailVisible.value = value ?? false),
);
function selectDetail(value: boolean) {
  detailVisible.value = value;
  emit("update:detailVisible", value);
}
</script>
