<template>
  <form
    class="report-filters"
    novalidate
    :aria-label="t('report.filters')"
    @submit.prevent="applyFilters"
  >
    <sc-text-field
      v-model="q"
      :label="t('report.search')"
      :max-length="200"
      :error-messages="form.errors.value.q"
      :disabled="busy"
    />
    <sc-select
      v-model="menuId"
      :label="t('request.menu')"
      :options="menuOptions"
      :error-messages="form.errors.value.menuId"
      :disabled="busy"
    />
    <sc-select
      v-model="status"
      :label="t('request.status')"
      :options="statusOptions"
      :error-messages="form.errors.value.status"
      :disabled="busy"
    />
    <sc-select
      v-model="authorId"
      :label="t('request.author')"
      :options="authorOptions"
      :error-messages="form.errors.value.authorId"
      :disabled="busy"
    />
    <sc-select
      v-model="size"
      :label="t('request.pageSize')"
      :options="sizeOptions"
      :error-messages="form.errors.value.size"
      :disabled="busy"
    />
    <div class="report-filter-actions">
      <sc-action-button type="submit" :busy="busy">{{ t("report.submit") }}</sc-action-button>
      <sc-action-button variant="outlined" :disabled="busy" @click="emit('reset')">
        {{ t("report.reset") }}
      </sc-action-button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScActionButton, ScSelect, ScTextField } from "@sc/ui";
import type { Menu, User } from "../../requirements/api";
import {
  reportFilterSchema,
  reportStatuses,
  type RequirementReportFilters,
  type ReportFilterDraft,
  type ReportFilterInput,
} from "./filters";

const props = defineProps<{
  filters: RequirementReportFilters;
  menus: readonly Menu[];
  users: readonly User[];
  busy: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{ apply: [input: ReportFilterInput]; reset: [] }>();
const { t } = useI18n({ useScope: "global" });
function initialValues(): ReportFilterDraft {
  return {
    q: props.filters.q,
    menuId: props.filters.menuId === null ? "" : String(props.filters.menuId),
    status: props.filters.status,
    authorId: props.filters.authorId === null ? "" : String(props.filters.authorId),
    size: String(props.filters.size),
  };
}
const form = useForm<ReportFilterDraft>({ initialValues: initialValues() });
const [q] = form.defineField("q");
const [menuId] = form.defineField("menuId");
const [status] = form.defineField("status");
const [authorId] = form.defineField("authorId");
const [size] = form.defineField("size");
const allOption = computed(() => ({ value: "", label: t("request.all") }));
const menuOptions = computed(() => [
  allOption.value,
  ...props.menus.map((item) => ({ value: String(item.id), label: item.name })),
]);
const authorOptions = computed(() => [
  allOption.value,
  ...props.users.map((item) => ({ value: String(item.id), label: item.displayName })),
]);
const statusOptions = computed(() => [
  allOption.value,
  ...reportStatuses.map((value) => ({ value, label: t(`request.statuses.${value}`) })),
]);
const sizeOptions = computed(() =>
  [...new Set([10, 20, 50, 100, props.filters.size])]
    .sort((left, right) => left - right)
    .map((value) => ({ value: String(value), label: String(value) })),
);
// 페이지·정렬·보기 변경으로 아직 제출하지 않은 검색 입력을 덮어쓰지 않는다.
watch(
  [
    () => props.filters.q,
    () => props.filters.menuId,
    () => props.filters.status,
    () => props.filters.authorId,
    () => props.filters.size,
  ],
  () => form.resetForm({ values: initialValues() }),
);
function clearErrors() {
  form.setErrors({
    q: undefined,
    menuId: undefined,
    status: undefined,
    authorId: undefined,
    size: undefined,
  });
}
watch(
  () => props.serverErrors,
  (errors) => {
    clearErrors();
    form.setErrors(errors);
  },
  { immediate: true },
);
function applyFilters() {
  if (props.busy) return;
  clearErrors();
  const result = reportFilterSchema.safeParse(form.values);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (
        field === "q" ||
        field === "menuId" ||
        field === "status" ||
        field === "authorId" ||
        field === "size"
      )
        form.setFieldError(
          field,
          t(`report.validation.${field === "status" ? "status" : issue.message}`),
        );
    }
    return;
  }
  emit("apply", result.data);
}
</script>

<style scoped>
.report-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: var(--sc-space-4);
  align-items: start;
}
.report-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-2);
}
</style>
