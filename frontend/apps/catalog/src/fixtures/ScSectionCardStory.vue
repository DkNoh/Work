<template>
  <sc-section-card v-bind="card">
    <p>슬롯 본문</p>
    <template #actions>
      <sc-action-button variant="text" size="sm" intent="secondary">상세 행동</sc-action-button>
    </template>
  </sc-section-card>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Controls의 card props를 전달하고 default 본문과 actions named slot에 각 콘텐츠를 넣는다.
 */

/*
 * 공개 ScSectionCardProps를 그대로 받는 최소 소비 예제다. slot은 카드가 소유하지 않는 부모 콘텐츠 영역이며 추가 로컬 상태/API가 필요 없다.
 */
import { ScActionButton, ScSectionCard, type ScSectionCardProps } from "@sc/ui";
defineProps<{ card: ScSectionCardProps }>();
</script>
