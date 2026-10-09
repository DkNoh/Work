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
        <!-- key가 선택 ID/성공 reset으로 바뀔 때만 자식 인스턴스를 재생성한다. Query 재조회로 props가 바뀌는 것과 폼 초기화는 구분된다. -->
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 메뉴 조회/편집 선택 화면. allowed에 따라 관리 영역을 생성하지만 실제 권한 검사는 서버가 매 요청 수행한다.
 */

// 메뉴 조회/편집 선택의 화면 흐름을 조정한다. 서버 응답은 Query, 저장 전 입력은 Form/ref, 공유 경로와 선택은 Router가 소유한다.
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
// computed는 현재 identity의 역할을 읽어 화면 상태를 계산한다. 브라우저의 ADMIN 표시를 신뢰해 서버 검사를 생략하면 안 된다.
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
// useQuery는 cache key별 data/error/loading을 관리한다. signal은 공통 API로 전달하고 enabled로 조건을 만족할 때만 자동 조회한다.
const query = useQuery({
  queryKey: adminKeys.menus,
  queryFn: ({ signal }) => api.menus(signal),
  enabled: allowed,
});
// URL id를 엄격한 양의 정수로 해석한다. selected는 조회 목록에서 파생하며 별도 mutable 선택 복사본을 두지 않는다.
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
// id가 있더라도 문법이 틀리거나 목록에서 찾지 못하면 신규 폼으로 오인하지 않고 오류를 표시한다.
const invalidSelection = computed(
  () =>
    route.query.id !== undefined &&
    (selectedId.value === null || (!!query.data.value && selected.value === null)),
);
const reset = ref(0);
const saved = ref(false);
// MenuForm의 저장 성공 이벤트를 받는다. 목록 갱신을 기다린 후 reset을 올려 자식 key를 바꾸고 새 성공 기준으로 폼을 만든다.
async function savedMenu() {
  await runtime.queryClient.invalidateQueries({ queryKey: adminKeys.menus });
  reset.value++;
  saved.value = true;
}
</script>
