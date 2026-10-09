<template>
  <v-app class="sc-app sc-story-frame">
    <v-main>
      <div class="sc-content sc-story-frame__content"><slot /></div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Story 화면을 Vuetify VApp/VMain과 공통 콘텐츠 폭으로 감싸고 default slot에 실제 예제를 넣는다.
 */

/*
 * 공통 Storybook decorator가 사용하는 표시 틀이다. 업무 앱 셸이나 라우팅을 import하지 않으며 테마가 적용될 Vuetify 문맥만 제공한다.
 */
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
