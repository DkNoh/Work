<template>
  <sc-section-card v-bind="card">
    <p>슬롯 본문</p>
    <template #actions>
      <sc-action-button variant="text" size="sm" intent="secondary">상세 행동</sc-action-button>
    </template>
  </sc-section-card>
</template>
<script setup lang="ts">
import { ScActionButton, ScSectionCard, type ScSectionCardProps } from "@sc/ui";
defineProps<{ card: ScSectionCardProps }>();
</script>
