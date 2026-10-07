<template>
  <form
    novalidate
    class="sc-stack"
    :aria-label="t('request.reviewForm')"
    @submit.prevent="saveReview"
  >
    <sc-select
      v-model="decisionModel"
      :label="t('request.decision')"
      :options="decisionOptions"
      :error-messages="form.errors.value.decision"
      :disabled="busy"
      required
    />
    <sc-text-area
      v-model="rationale"
      :label="t('request.rationale')"
      :error-messages="form.errors.value.rationale"
      :disabled="busy"
      required
      :max-length="10000"
    />
    <sc-text-area
      v-model="conditions"
      :label="t('request.conditions')"
      :error-messages="form.errors.value.conditions"
      :disabled="busy"
      :max-length="10000"
    />
    <sc-text-area
      v-model="scope"
      :label="t('request.scope')"
      :error-messages="form.errors.value.scope"
      :disabled="busy"
      :max-length="10000"
    />
    <sc-text-area
      v-model="exclusions"
      :label="t('request.exclusions')"
      :error-messages="form.errors.value.exclusions"
      :disabled="busy"
      :max-length="10000"
    />
    <sc-text-area
      v-model="acceptance"
      :label="t('request.acceptance')"
      :error-messages="form.errors.value.acceptance"
      :disabled="busy"
      :max-length="10000"
    />
    <sc-select
      v-model="estimateModel"
      :label="t('request.estimate')"
      :options="estimateOptions"
      :error-messages="form.errors.value.estimate"
      :disabled="busy"
      required
    />
    <sc-checkbox v-model="needsInfo" :label="t('request.needsInfo')" :disabled="busy" />
    <p>{{ t("request.reviewHint") }}</p>
    <sc-form-actions :busy="busy" :submit-label="t('request.saveReview')" :show-cancel="false" />
  </form>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScFormActions, ScSelect, ScTextArea } from "@sc/ui";
import type { RequirementDetail } from "./api";
import { reviewSchema, schemaErrors, type ReviewDraft } from "./schema";

const props = defineProps<{
  initial: RequirementDetail;
  resetKey: number;
  busy: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{ save: [draft: ReviewDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "global" });
const form = useForm<ReviewDraft>({
  initialValues: {
    decision: "UNREVIEWED",
    rationale: "",
    conditions: "",
    scope: "",
    exclusions: "",
    acceptance: "",
    estimate: "UNKNOWN",
    needsInfo: false,
  },
});
const [decision] = form.defineField("decision");
const [rationale] = form.defineField("rationale");
const [conditions] = form.defineField("conditions");
const [scope] = form.defineField("scope");
const [exclusions] = form.defineField("exclusions");
const [acceptance] = form.defineField("acceptance");
const [estimate] = form.defineField("estimate");
const [needsInfo] = form.defineField("needsInfo");
const decisionOptions = computed(() =>
  ["UNREVIEWED", "POSSIBLE", "CONDITIONAL", "MORE_INFO", "IMPOSSIBLE"].map((value) => ({
    value,
    label: t(`request.decisions.${value}`),
  })),
);
const estimateOptions = computed(() =>
  ["UNKNOWN", "SMALL", "MEDIUM", "LARGE"].map((value) => ({
    value,
    label: t(`request.estimates.${value}`),
  })),
);
const decisionModel = computed({
  get: () => decision.value,
  set: (value: string | null) => {
    const parsed = reviewSchema.shape.decision.safeParse(value);
    if (parsed.success) decision.value = parsed.data;
  },
});
const estimateModel = computed({
  get: () => estimate.value,
  set: (value: string | null) => {
    const parsed = reviewSchema.shape.estimate.safeParse(value);
    if (parsed.success) estimate.value = parsed.data;
  },
});
watch(
  () => props.resetKey,
  () => {
    const review = props.initial.review;
    form.resetForm({
      values: {
        decision: review?.decision ?? "UNREVIEWED",
        rationale: review?.rationale ?? "",
        conditions: review?.conditions ?? "",
        scope: review?.scope ?? "",
        exclusions: review?.exclusions ?? "",
        acceptance: review?.acceptance ?? "",
        estimate: review?.estimate ?? "UNKNOWN",
        needsInfo: props.initial.status === "NEEDS_INFO",
      },
    });
  },
  { immediate: true },
);
function clearErrors() {
  form.setErrors(Object.fromEntries(Object.keys(form.values).map((field) => [field, undefined])));
}
watch(
  () => props.serverErrors,
  (errors) => {
    clearErrors();
    form.setErrors(errors);
  },
);
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
function saveReview() {
  if (props.busy) return;
  clearErrors();
  const result = reviewSchema.safeParse(form.values);
  if (!result.success) {
    form.setErrors(schemaErrors(result.error.issues));
    return;
  }
  emit("save", result.data);
}
</script>
