<template>
  <nav :aria-label="t('title')" class="admin-navigation">
    <router-link v-for="item in links" :key="item.path" :to="item.path">
      {{ item.label }}
    </router-link>
  </nav>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * RouterLink가 전체 문서 새로고침 없이 관리 하위 화면으로 이동한다. :key=path는 반복 링크의 식별자다.
 */

// 관리 화면의 탐색 전용 컴포넌트다. computed links는 언어가 바뀌면 표시 이름을 다시 계산하며 서버 자료를 저장하지 않는다.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { adminMessages } from "./messages";
const { t } = useI18n({ useScope: "local", messages: adminMessages });
// 객체 배열의 path는 실제 Router 경로다. 메뉴 가시성 자체가 서버 ADMIN 권한 검사를 대체하지 않는다.
const links = computed(() => [
  { path: "/admin/users", label: t("users") },
  { path: "/admin/menus", label: t("menus") },
  { path: "/admin/audit", label: t("audit") },
]);
</script>
<style scoped>
.admin-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.router-link-active {
  font-weight: 700;
}
</style>
