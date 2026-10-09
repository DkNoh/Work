<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('users')" />
    <admin-navigation />
    <p v-if="!allowed" role="alert">{{ t("denied") }}</p>
    <template v-else>
      <sc-section-card :title="t('createUser')">
        <form
          class="sc-stack"
          novalidate
          :aria-label="t('createUser')"
          @submit.prevent="createUser"
        >
          <sc-text-field
            v-model="username"
            :label="t('username')"
            :error-messages="form.errors.value.username"
            :disabled="busy"
            required
            :max-length="60"
            autocomplete="off"
          />
          <sc-text-field
            v-model="displayName"
            :label="t('displayName')"
            :error-messages="form.errors.value.displayName"
            :disabled="busy"
            required
            :max-length="80"
          />
          <sc-text-field
            v-model="password"
            type="password"
            :label="t('password')"
            :error-messages="form.errors.value.password"
            :disabled="busy"
            required
            autocomplete="new-password"
          />
          <p>{{ t("passwordRule") }}</p>
          <sc-select v-model="role" :label="t('role')" :options="roles" :disabled="busy" required />
          <p v-if="error" role="alert">{{ error }}</p>
          <p v-if="saved" role="status">{{ t("created") }}</p>
          <sc-form-actions :submit-label="t('createUser')" :busy="busy" :show-cancel="false" />
        </form>
      </sc-section-card>
      <!-- 사용자 목록은 Query 결과를 표시한다. refresh 버튼은 같은 Query를 다시 조회하며 생성 폼의 입력을 교체하지 않는다. -->
      <sc-section-card :title="t('users')">
        <sc-action-button
          variant="outlined"
          :busy="query.isFetching.value"
          @click="query.refetch()"
        >
          {{ t("refresh") }}
        </sc-action-button>
        <p v-if="query.isError.value" role="alert">{{ query.error.value?.message }}</p>
        <ul class="sc-stack">
          <li v-for="user in query.data.value ?? []" :key="user.id">
            {{ user.displayName }} · {{ user.username }} · {{ user.role }}
          </li>
        </ul>
      </sc-section-card>
    </template>
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 사용자 생성/조회 화면. allowed에 따라 관리 영역을 생성하지만 실제 권한 검사는 서버가 매 요청 수행한다.
 */

// 사용자 생성/조회의 화면 흐름을 조정한다. 서버 응답은 Query, 저장 전 입력은 Form/ref, 공유 경로와 선택은 Router가 소유한다.
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import {
  ScPageHeader,
  ScSectionCard,
  ScTextField,
  ScSelect,
  ScFormActions,
  ScActionButton,
} from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { formIssueMessages } from "../../shared/validation";
import { adminKeys, createAdminApi } from "./api";
import { adminMessages } from "./messages";
import AdminNavigation from "./AdminNavigation.vue";
const { t } = useI18n({ useScope: "local", messages: adminMessages });
const runtime = useReferenceRuntime();
const api = createAdminApi(runtime);
// computed는 현재 identity의 역할을 읽어 화면 상태를 계산한다. 브라우저의 ADMIN 표시를 신뢰해 서버 검사를 생략하면 안 된다.
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
// useQuery는 cache key별 data/error/loading을 관리한다. signal은 공통 API로 전달하고 enabled로 조건을 만족할 때만 자동 조회한다.
const query = useQuery({
  queryKey: adminKeys.users,
  queryFn: ({ signal }) => api.users(signal),
  enabled: allowed,
});
// 매번 새 폼 객체를 만든다. role의 as union은 허용 문자열 집합이라는 정적 타입이며 실제 요청 검증은 z.enum이 한다.
const initial = () => ({
  username: "",
  displayName: "",
  password: "",
  role: "REQUESTER" as "REQUESTER" | "REVIEWER" | "ADMIN",
});
const form = useForm({ initialValues: initial() });
const [username] = form.defineField("username");
const [displayName] = form.defineField("displayName");
const [password] = form.defineField("password");
const [role] = form.defineField("role");
const roles = ["REQUESTER", "REVIEWER", "ADMIN"].map((value) => ({ value, label: value }));
const busy = ref(false);
const error = ref("");
const saved = ref(false);
// 폼 제출 → Zod 계정명/표시이름/비밀번호/역할 검증 → POST → 폼 초기화 → 사용자/칸반 Query 무효화 순서다.
async function createUser() {
  if (busy.value || !allowed.value) return;
  error.value = "";
  saved.value = false;
  form.setErrors({
    username: undefined,
    displayName: undefined,
    password: undefined,
    role: undefined,
  });
  const parsed = z
    .object({
      username: z.string().regex(/^[A-Za-z0-9_.-]{3,60}$/, t("required")),
      displayName: z
        .string()
        .min(1)
        .max(80)
        .refine((value) => !!value.trim(), t("required")),
      password: z
        .string()
        .min(12, t("passwordRule"))
        .refine((value) => new TextEncoder().encode(value).byteLength <= 72, t("passwordRule")),
      role: z.enum(["REQUESTER", "REVIEWER", "ADMIN"]),
    })
    .safeParse(form.values);
  if (!parsed.success) {
    form.setErrors(formIssueMessages(parsed.error.issues));
    return;
  }
  busy.value = true;
  try {
    // 저장 성공 후 비밀번호를 포함한 입력을 즉시 비운다. 서버 필드 오류가 발생한 경우 catch에서 해당 입력 아래에 표시한다.
    await api.createUser(parsed.data);
    form.resetForm({ values: initial() });
    saved.value = true;
    await runtime.queryClient.invalidateQueries({ queryKey: adminKeys.users });
    await runtime.queryClient.invalidateQueries({ queryKey: ["kanban"] });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("required");
    if (cause instanceof ApiError) form.setErrors(cause.fields);
  } finally {
    busy.value = false;
  }
}
</script>
