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
