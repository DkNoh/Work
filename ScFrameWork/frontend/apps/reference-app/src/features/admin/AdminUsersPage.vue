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
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
const query = useQuery({
  queryKey: adminKeys.users,
  queryFn: ({ signal }) => api.users(signal),
  enabled: allowed,
});
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
