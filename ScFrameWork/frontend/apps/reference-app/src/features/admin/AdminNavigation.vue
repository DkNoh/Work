<template>
  <nav :aria-label="t('title')" class="admin-navigation">
    <router-link v-for="item in links" :key="item.path" :to="item.path">
      {{ item.label }}
    </router-link>
  </nav>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { adminMessages } from "./messages";
const { t } = useI18n({ useScope: "local", messages: adminMessages });
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
