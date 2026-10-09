<template>
  <div class="sc-actions" aria-label="상태 배지 예제">
    <template v-if="gallery">
      <sc-status-badge v-for="sample in samples" :key="sample.tone" v-bind="sample" />
    </template>
    <sc-status-badge v-else v-bind="badge" />
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Controls의 단일 badge 또는 각 tone의 합성 상태 gallery를 표시한다. v-for key는 중복 없는 tone이다.
 */

/*
 * 상태 이름과 tone을 공개 ScStatusBadgeProps로 조립하는 예제다. 업무 상태 코드 변환이나 상태 전이 API는 포함하지 않는다.
 *  정적 배지는 label을 표시하는 부품이므로 예제도 별도 live 알림을 추가하지 않는다.
 */
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
