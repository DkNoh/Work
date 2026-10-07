<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('audit')" :subtitle="t('auditHint')" />
    <admin-navigation />
    <p v-if="!allowed" role="alert">{{ t("denied") }}</p>
    <template v-else>
      <sc-section-card :title="t('search')">
        <form class="sc-stack" novalidate :aria-label="t('search')" @submit.prevent="searchEvents">
          <sc-text-field
            v-model="action"
            :label="t('eventAction')"
            :error-messages="form.errors.value.action"
            :max-length="64"
          />
          <sc-select v-model="outcome" :label="t('outcome')" :options="outcomes" />
          <sc-text-field
            v-model="actorSubject"
            :label="t('actor')"
            :error-messages="form.errors.value.actorSubject"
            :max-length="64"
          />
          <sc-form-actions
            :submit-label="t('search')"
            :busy="query.isFetching.value"
            :show-cancel="false"
          />
        </form>
      </sc-section-card>
      <p v-if="!valid" role="alert">{{ t("invalidQuery") }}</p>
      <p v-if="query.isError.value" role="alert">{{ query.error.value?.message }}</p>
      <sc-action-button
        variant="outlined"
        :disabled="!valid"
        :busy="query.isFetching.value"
        @click="query.refetch()"
      >
        {{ t("refresh") }}
      </sc-action-button>
      <sc-section-card :title="t('audit')" :aria-busy="query.isFetching.value || undefined">
        <p v-if="query.data.value?.items.length === 0">{{ t("empty") }}</p>
        <ol class="audit-list sc-stack">
          <li v-for="item in query.data.value?.items ?? []" :key="item.id">
            <h2>{{ item.action }} · {{ item.outcome }}</h2>
            <dl class="audit-fields">
              <div>
                <dt>{{ t("occurredAt") }}</dt>
                <dd>{{ displayTime(item.occurredAt) }}</dd>
              </div>
              <div>
                <dt>{{ t("actor") }}</dt>
                <dd>{{ item.actorSubject }} · {{ item.actorId ?? "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("resource") }}</dt>
                <dd>{{ item.resourceType }} · {{ item.resourceId ?? "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("requestId") }}</dt>
                <dd>{{ item.requestId ?? "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("reason") }}</dt>
                <dd>{{ item.reasonCode ?? "—" }}</dd>
              </div>
            </dl>
          </li>
        </ol>
        <div class="audit-pagination">
          <sc-action-button
            variant="outlined"
            :disabled="!valid || parsed.page === 0 || query.isFetching.value"
            @click="changePage(parsed.page - 1)"
          >
            {{ t("previous") }}
          </sc-action-button>
          <p role="status">
            {{ t("page", { current: parsed.page + 1, total: query.data.value?.total ?? 0 }) }}
          </p>
          <sc-action-button
            variant="outlined"
            :disabled="
              !valid ||
              query.isFetching.value ||
              (parsed.page + 1) * 20 >= (query.data.value?.total ?? 0)
            "
            @click="changePage(parsed.page + 1)"
          >
            {{ t("next") }}
          </sc-action-button>
        </div>
      </sc-section-card>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { z } from "zod";
import { createDateFormatter } from "@sc/date";
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
const { t, locale } = useI18n({ useScope: "local", messages: adminMessages });
const runtime = useReferenceRuntime();
const route = useRoute();
const api = createAdminApi(runtime);
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
const parsed = computed(() => {
  const page = route.query.page ?? "0";
  const action = route.query.action ?? "";
  const outcome = route.query.outcome ?? "";
  const actorSubject = route.query.actorSubject ?? "";
  const valid =
    typeof page === "string" &&
    /^(0|[1-9]\d*)$/.test(page) &&
    Number(page) <= 1_000_000 &&
    typeof action === "string" &&
    (!action || /^[A-Z][A-Z0-9_]{0,63}$/.test(action)) &&
    typeof outcome === "string" &&
    ["", "SUCCESS", "FAILURE", "DENIED"].includes(outcome) &&
    typeof actorSubject === "string" &&
    (!actorSubject || /^[A-Za-z0-9._@-]{1,64}$/.test(actorSubject));
  return {
    valid,
    page: valid ? Number(page) : 0,
    action: typeof action === "string" ? action : "",
    outcome: typeof outcome === "string" ? outcome : "",
    actorSubject: typeof actorSubject === "string" ? actorSubject : "",
  };
});
const valid = computed(() => parsed.value.valid);
const parameters = computed(() => {
  const query = new URLSearchParams({ page: String(parsed.value.page), size: "20" });
  for (const field of ["action", "outcome", "actorSubject"] as const)
    if (parsed.value[field]) query.set(field, parsed.value[field]);
  return query;
});
const query = useQuery({
  queryKey: computed(() => [...adminKeys.audit, parameters.value.toString()]),
  queryFn: ({ signal }) => api.audit(parameters.value, signal),
  enabled: computed(() => allowed.value && valid.value),
});
const form = useForm({
  initialValues: {
    action: parsed.value.action,
    outcome: parsed.value.outcome,
    actorSubject: parsed.value.actorSubject,
  },
});
const [action] = form.defineField("action");
const [outcome] = form.defineField("outcome");
const [actorSubject] = form.defineField("actorSubject");
const outcomes = computed(() => [
  { value: "", label: t("all") },
  { value: "SUCCESS", label: t("success") },
  { value: "FAILURE", label: t("failure") },
  { value: "DENIED", label: t("deniedOutcome") },
]);
// 페이지 변경은 미적용 조회 입력을 보존하고, URL의 적용 필터가 바뀐 경우만 초기화한다.
watch(
  () => JSON.stringify([parsed.value.action, parsed.value.outcome, parsed.value.actorSubject]),
  () =>
    form.resetForm({
      values: {
        action: parsed.value.action,
        outcome: parsed.value.outcome,
        actorSubject: parsed.value.actorSubject,
      },
    }),
);
const dates = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
function displayTime(value: string) {
  return dates.value.formatTimestamp(value);
}
async function searchEvents() {
  if (query.isFetching.value) return;
  const result = z
    .object({
      action: z
        .string()
        .refine((value) => !value || /^[A-Z][A-Z0-9_]{0,63}$/.test(value), t("required")),
      outcome: z.enum(["", "SUCCESS", "FAILURE", "DENIED"]),
      actorSubject: z
        .string()
        .refine((value) => !value || /^[A-Za-z0-9._@-]{1,64}$/.test(value), t("required")),
    })
    .safeParse(form.values);
  form.setErrors({ action: undefined, outcome: undefined, actorSubject: undefined });
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  await runtime.router.push({ path: "/admin/audit", query: { ...result.data, page: "0" } });
}
async function changePage(page: number) {
  if (!valid.value || query.isFetching.value || page < 0 || page > 1_000_000) return;
  await runtime.router.push({
    path: "/admin/audit",
    query: {
      action: parsed.value.action,
      outcome: parsed.value.outcome,
      actorSubject: parsed.value.actorSubject,
      page: String(page),
    },
  });
}
</script>
<style scoped>
.audit-list {
  list-style: none;
  padding: 0;
}
.audit-list > li {
  padding: var(--sc-space-4);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
}
.audit-list h2 {
  font-size: var(--sc-font-size-section);
}
.audit-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-3);
}
.audit-fields dt {
  color: var(--sc-color-text-muted);
}
.audit-fields dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.audit-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-3);
}
</style>
