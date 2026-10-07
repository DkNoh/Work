<template>
  <v-app class="sc-app sc-story-frame">
    <v-main>
      <div class="sc-content sc-story-frame__content"><slot /></div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { VApp, VMain } from "vuetify/components";
</script>

<style scoped lang="scss">
.sc-story-frame :deep(.v-application__wrap) {
  min-height: auto;
}
.sc-story-frame__content {
  min-height: 240px;
  padding-block: var(--sc-space-8);
}
</style>
