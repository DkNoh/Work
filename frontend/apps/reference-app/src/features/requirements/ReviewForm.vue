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
    <!-- 공통 액션 컴포넌트가 submit 버튼을 표시한다. busy는 조작 표시이고 서버 권한 검사는 별도로 수행된다. -->
    <sc-form-actions :busy="busy" :submit-label="t('request.saveReview')" :show-cancel="false" />
  </form>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 검토 입력 영역. v-model은 폼 필드와 연결하고 @submit.prevent는 전체 페이지 전송을 막아 saveReview를 실행한다.
 */

// 검토의 입력/검증을 맡는 자식 컴포넌트다. API 호출과 저장 후 Query 갱신은 부모 화면이 맡는다.
// <script setup>의 최상위 변수/함수는 template에서 사용할 수 있고, TS 타입은 빌드 시 제거된다.
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScFormActions, ScSelect, ScTextArea } from "@sc/ui";
import type { RequirementDetail } from "./api";
import { reviewSchema, schemaErrors, type ReviewDraft } from "./schema";

// props는 부모가 내려주는 읽기 전용 계약이다. initial을 직접 수정하지 않고 useForm의 별도 입력에 복사한다.
// resetKey는 부모가 선택 변경/저장 성공/명시적 최신 조회를 승인했다는 신호이며 일반 재조회만으로 입력을 덮지 않는다.
const props = defineProps<{
  initial: RequirementDetail;
  resetKey: number;
  busy: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
// defineEmits의 튜플은 이벤트 인수 타입이다. emit("save", 값)이 부모의 @save 핸들러로 전달된다.
const emit = defineEmits<{ save: [draft: ReviewDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "global" });
// useForm<T>는 값·오류·dirty 상태를 묶는다. defineField가 돌려준 첫 ref를 v-model에 연결하며 script에서는 .value로 접근한다.
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
// setter를 가진 computed는 문자열/null을 받는 공통 선택 컴포넌트와 좁은 enum 폼 필드 사이의 어댑터다.
// 선택값도 enum.safeParse로 확인한 후에만 실제 decision/estimate ref를 갱신한다.
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
// watch는 감시 값이 바뀔 때 부수 효과를 실행한다. resetForm은 표시 값뿐 아니라 dirty/검증 기준도 새로 잡는다.
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
// 서버 ApiError.fields는 부모를 통해 전달된다. 필드 오류를 form에 붙이면 template의 error-messages로 표시된다.
watch(
  () => props.serverErrors,
  (errors) => {
    clearErrors();
    form.setErrors(errors);
  },
);
// dirty를 이벤트로 올려 부모의 이동 확인/다른 저장 채널과 연결한다. ref를 서버 세션에 저장하는 동작은 아니다.
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
// 제출 → busy로 중복 제출 방지 → safeParse 런타임 검증 → save 이벤트 순서다.
// success=false일 때는 필드 오류만 갱신하고 입력을 유지한다. 검증 성공도 DB 저장 성공을 의미하지 않는다.
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
