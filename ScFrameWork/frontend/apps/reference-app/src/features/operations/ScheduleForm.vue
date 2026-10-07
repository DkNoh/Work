<template>
  <form class="sc-stack" novalidate :aria-label="t('scheduleForm')" @submit.prevent="saveSchedule">
    <sc-select
      v-model="jobCode"
      :label="t('job')"
      :options="jobOptions"
      :error-messages="form.errors.value.jobCode"
      :disabled="busy || readonly"
      required
    />
    <sc-text-field
      v-model="cron"
      :label="t('cron')"
      :hint="t('cronHint')"
      :error-messages="form.errors.value.cron"
      :readonly="readonly"
      :disabled="busy"
      :max-length="120"
      required
    />
    <sc-text-field
      v-model="timeZone"
      :label="t('timeZone')"
      :error-messages="form.errors.value.timeZone"
      :readonly="readonly"
      :disabled="busy"
      :max-length="64"
      required
    />
    <sc-select
      v-model="misfirePolicy"
      :label="t('misfire')"
      :options="misfireOptions"
      :error-messages="form.errors.value.misfirePolicy"
      :disabled="busy || readonly"
      required
    />
    <sc-checkbox v-model="enabled" :label="t('enabled')" :disabled="busy" :readonly="readonly" />
    <p v-if="basisRevision !== null">
      {{ t("revision") }}:
      <span data-testid="schedule-revision">{{ basisRevision }}</span>
    </p>
    <sc-form-actions
      :busy="busy"
      :busy-label="t('processing')"
      :disabled="readonly"
      :submit-label="t('save')"
      :show-cancel="false"
    />
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { z } from "zod";
import { ScCheckbox, ScFormActions, ScSelect, ScTextField } from "@sc/ui";
import type { RegisteredJobs, Schedule, ScheduleInput } from "./api";
import { operationMessages } from "./messages";
const props = defineProps<{
  initial: Schedule | null;
  resetKey: number;
  jobs: RegisteredJobs["items"];
  busy: boolean;
  readonly: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{
  save: [input: ScheduleInput, revision: number | null];
  "dirty-change": [dirty: boolean];
}>();
const { t } = useI18n({ useScope: "local", messages: operationMessages });
const emptyDraft = () => ({
  jobCode: "",
  cron: "0 * * * * ?",
  timeZone: "UTC",
  misfirePolicy: "SKIP",
  enabled: true,
});
const form = useForm({ initialValues: emptyDraft() });
const [jobCode] = form.defineField("jobCode");
const [cron] = form.defineField("cron");
const [timeZone] = form.defineField("timeZone");
const [misfirePolicy] = form.defineField("misfirePolicy");
const [enabled] = form.defineField("enabled");
const basisRevision = ref<number | null>(null);
const jobOptions = computed(() =>
  props.jobs.map((job) => ({ value: job.jobCode, label: `${job.jobCode} · ${job.executionMode}` })),
);
const misfireOptions = computed(() => [
  { value: "SKIP", label: t("skip") },
  { value: "FIRE_ONCE", label: t("fireOnce") },
]);
const schema = computed(() =>
  z.object({
    jobCode: z
      .string()
      .refine((value) => props.jobs.some((job) => job.jobCode === value), t("validation")),
    // 복잡한 cron 문법의 최종 검증은 서버가 맡고, 입력 화면은 고정 초와 필드 수를 먼저 확인한다.
    cron: z
      .string()
      .max(120)
      .refine((value) => {
        const fields = value.trim().split(/\s+/);
        return (
          value === value.trim() &&
          (fields.length === 6 || fields.length === 7) &&
          fields[0] === "0"
        );
      }, t("cronHint")),
    timeZone: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }, t("validation")),
    misfirePolicy: z.enum(["SKIP", "FIRE_ONCE"]),
    enabled: z.boolean(),
  }),
);
// 서버 자료가 재조회돼도 작성 중인 입력과 기준 revision은 자동으로 교체하지 않는다.
watch(
  () => props.resetKey,
  () => {
    const initial = props.initial;
    basisRevision.value = initial?.revision ?? null;
    form.resetForm({
      values: initial
        ? {
            jobCode: initial.jobCode,
            cron: initial.cron,
            timeZone: initial.timeZone,
            misfirePolicy: initial.misfirePolicy,
            enabled: initial.enabled,
          }
        : emptyDraft(),
    });
  },
  { immediate: true },
);
watch(
  () => props.serverErrors,
  (errors) => form.setErrors(errors),
);
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
function saveSchedule() {
  if (props.busy || props.readonly) return;
  form.setErrors({
    jobCode: undefined,
    cron: undefined,
    timeZone: undefined,
    misfirePolicy: undefined,
  });
  const result = schema.value.safeParse(form.values);
  if (!result.success) {
    form.setErrors(
      Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    );
    return;
  }
  emit("save", result.data, basisRevision.value);
}
</script>
