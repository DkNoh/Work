<template>
  <div class="sc-actions" aria-label="상태 배지 예제">
    <template v-if="gallery">
      <sc-status-badge v-for="sample in samples" :key="sample.tone" v-bind="sample" />
    </template>
    <sc-status-badge v-else v-bind="badge" />
  </div>
</template>
<script setup lang="ts">
import { ScStatusBadge, type ScStatusBadgeProps } from "@sc/ui";
withDefaults(defineProps<{ badge: ScStatusBadgeProps; gallery?: boolean }>(), { gallery: false });
const samples: readonly ScStatusBadgeProps[] = [
  { label: "작성 중", tone: "neutral" },
  { label: "진행 중", tone: "primary" },
  { label: "검토 중", tone: "secondary" },
  { label: "처리 완료", tone: "success" },
  { label: "확인 필요", tone: "warning" },
  { label: "처리 실패", tone: "danger" },
  { label: "안내", tone: "info" },
];
</script>
