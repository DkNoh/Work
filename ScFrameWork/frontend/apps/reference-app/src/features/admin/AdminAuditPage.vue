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
        <!-- 공개 감사 DTO의 메타데이터만 반복 표시한다. 본문/비밀번호/토큰을 출력하는 영역이 아니다. -->
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 감사 이벤트 검색 화면. allowed에 따라 관리 영역을 생성하지만 실제 권한 검사는 서버가 매 요청 수행한다.
 */

// 감사 이벤트 검색의 화면 흐름을 조정한다. 서버 응답은 Query, 저장 전 입력은 Form/ref, 공유 경로와 선택은 Router가 소유한다.
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
// computed는 현재 identity의 역할을 읽어 화면 상태를 계산한다. 브라우저의 ADMIN 표시를 신뢰해 서버 검사를 생략하면 안 된다.
const allowed = computed(() => runtime.session.identity?.role === "ADMIN");
// URL 문자열/배열/null을 검증한다. audit action/outcome/actorSubject 형식과 페이지 범위를 통과하지 않으면 자동 조회를 막는다.
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
// 적용된 URL 조건만 URLSearchParams로 만든다. 입력 중인 form 값은 아직 요청 조건이 아니다.
const parameters = computed(() => {
  // useQuery는 cache key별 data/error/loading을 관리한다. signal은 공통 API로 전달하고 enabled로 조건을 만족할 때만 자동 조회한다.
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
// 검색 폼은 미적용 입력을 소유한다. watch는 적용 필터 변화만 따라가므로 페이지 이동이 작성 중인 검색어를 지우지 않는다.
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
// 검색 제출 시 safeParse로 검증한 뒤 URL page=0으로 이동한다. Query key 변화가 실제 GET을 실행한다.
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
// 유효 범위와 조회 중 여부를 확인하고 이미 적용된 조건으로 다음 URL을 만든다. 미적용 폼 값으로 페이지 요청을 바꾸지 않는다.
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
