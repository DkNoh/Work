<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('menus')" />
    <admin-navigation />
    <p v-if="!allowed" role="alert">{{ t("denied") }}</p>
    <template v-else>
      <sc-section-card :title="t('menus')">
        <router-link to="/admin/menus">{{ t("newMenu") }}</router-link>
        <sc-action-button
          variant="outlined"
          :busy="query.isFetching.value"
          @click="query.refetch()"
        >
          {{ t("refresh") }}
        </sc-action-button>
        <p v-if="query.isError.value" role="alert">{{ query.error.value?.message }}</p>
        <ul class="sc-stack">
          <li v-for="menu in query.data.value ?? []" :key="menu.id">
            <router-link :to="{ path: '/admin/menus', query: { id: menu.id } }">
              {{ menu.name }}
            </router-link>
            · {{ menu.sortOrder }} · {{ menu.active === 1 ? t("active") : "—" }}
          </li>
        </ul>
      </sc-section-card>
      <sc-section-card :title="t(selected ? 'editMenu' : 'createMenu')">
        <p v-if="invalidSelection" role="alert">{{ t("invalidQuery") }}</p>
        <menu-form
          v-else-if="query.data.value"
          :key="`${selectedId}-${reset}`"
          :initial="selected"
          :menus="query.data.value"
          @saved="savedMenu"
        />
        <p v-if="saved" role="status">{{ t("created") }}</p>
      </sc-section-card>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ScPageHeader, ScSectionCard, ScActionButton } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { adminKeys, createAdminApi } from "./api";
import { adminMessages } from "./messages";
import AdminNavigation from "./AdminNavigation.vue";
import MenuForm from "./MenuForm.vue";
const { t } = useI18n({ useScope: "local", messages: adminMessages });
const runtime = useReferenceRuntime();
const route = useRoute();
const api = createAdminApi(runtime);
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
const query = useQuery({
  queryKey: adminKeys.menus,
  queryFn: ({ signal }) => api.menus(signal),
  enabled: allowed,
});
const selectedId = computed(() =>
  typeof route.query.id === "string" &&
  /^[1-9]\d*$/.test(route.query.id) &&
  Number.isSafeInteger(Number(route.query.id))
    ? Number(route.query.id)
    : null,
);
const selected = computed(
  () => query.data.value?.find((menu) => menu.id === selectedId.value) ?? null,
);
const invalidSelection = computed(
  () =>
    route.query.id !== undefined &&
    (selectedId.value === null || (!!query.data.value && selected.value === null)),
);
const reset = ref(0);
const saved = ref(false);
async function savedMenu() {
  await runtime.queryClient.invalidateQueries({ queryKey: adminKeys.menus });
  reset.value++;
  saved.value = true;
}
</script>
