<template>
  <nav :aria-label="t('operations')" class="operations-navigation">
    <router-link v-if="access.messaging.value" to="/operations/messages">
      {{ t("messages") }}
    </router-link>
    <router-link v-if="access.scheduler.value" to="/operations/schedules">
      {{ t("schedules") }}
    </router-link>
    <router-link v-if="access.browserErrors.value" to="/operations/browser-errors">
      {{ t("browserErrors") }}
    </router-link>
  </nav>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 각 capability를 v-if로 확인해 메시지·예약·오류 화면 링크를 표시한다. nav의 aria-label은 보조기기에 영역 이름을 제공한다.
 */

/**
 * 현재 앱에서 활성화되고 사용 권한이 있는 운영 화면 링크만 구성한다. RouterLink는 전체 문서를 새로 받지 않고 클라이언트 라우트를 변경한다.
 * useOperationsAccess의 반환 객체 안 computed는 template에서 access.messaging.value처럼 중첩 ref를 명시적으로 읽는다.
 */

import { useI18n } from "vue-i18n";
import { useOperationsAccess } from "./capabilities";
import { operationMessages } from "./messages";
const { t } = useI18n({ useScope: "local", messages: operationMessages });
const access = useOperationsAccess();
</script>
<style scoped>
.operations-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.operations-navigation a {
  padding: var(--sc-space-2);
}
</style>
