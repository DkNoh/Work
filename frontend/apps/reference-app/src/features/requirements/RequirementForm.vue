<template>
  <form novalidate class="sc-stack" :aria-label="t('request.bodyForm')" @submit.prevent="saveBody">
    <sc-select
      v-model="menuId"
      :label="t('request.menu')"
      :options="menuOptions"
      :error-messages="form.errors.value.menuId"
      :readonly="readonly"
      :disabled="busy"
      required
    />
    <sc-text-field
      v-model="title"
      :label="t('request.title')"
      :error-messages="form.errors.value.title"
      :readonly="readonly"
      :disabled="busy"
      :max-length="200"
      required
    />
    <sc-text-area
      v-model="desired"
      :label="t('request.desired')"
      :error-messages="form.errors.value.desired"
      :readonly="readonly"
      :disabled="busy"
      :rows="4"
      :max-length="20000"
      required
    />
    <sc-text-area
      v-model="reason"
      :label="t('request.reason')"
      :error-messages="form.errors.value.reason"
      :readonly="readonly"
      :disabled="busy"
      :rows="3"
      :max-length="10000"
      required
    />
    <sc-text-area
      v-model="referenceText"
      :label="t('request.referenceText')"
      :error-messages="form.errors.value.referenceText"
      :readonly="readonly"
      :disabled="busy"
      :max-length="10000"
    />
    <sc-checkbox
      v-model="similar"
      :label="t('request.similar')"
      :readonly="readonly"
      :disabled="busy"
    />
    <sc-text-area
      v-model="followParts"
      :label="t('request.followParts')"
      :error-messages="form.errors.value.followParts"
      :readonly="readonly"
      :disabled="busy"
      :required="similar"
      :max-length="10000"
    />
    <p v-if="!imageMode" class="request-scope">{{ t("request.imageScope") }}</p>
    <!-- 공통 액션 컴포넌트가 submit 버튼을 표시한다. busy/readonly는 조작 표시이고 서버 권한 검사는 별도로 수행된다. -->
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('request.save')"
      :show-cancel="false"
    />
  </form>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 요구사항 본문 입력 영역. v-model은 폼 필드와 연결하고 @submit.prevent는 전체 페이지 전송을 막아 saveBody를 실행한다.
 */

// 요구사항 본문의 입력/검증을 맡는 자식 컴포넌트다. API 호출과 저장 후 Query 갱신은 부모 화면이 맡는다.
// <script setup>의 최상위 변수/함수는 template에서 사용할 수 있고, TS 타입은 빌드 시 제거된다.
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScFormActions, ScSelect, ScTextArea, ScTextField } from "@sc/ui";
import type { Menu, RequirementDetail } from "./api";
import { requirementSchema, schemaErrors, type RequirementDraft } from "./schema";

// props는 부모가 내려주는 읽기 전용 계약이다. initial을 직접 수정하지 않고 useForm의 별도 입력에 복사한다.
// resetKey는 부모가 선택 변경/저장 성공/명시적 최신 조회를 승인했다는 신호이며 일반 재조회만으로 입력을 덮지 않는다.
const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  menus: readonly Menu[];
  busy: boolean;
  readonly: boolean;
  serverErrors: Readonly<Record<string, string>>;
  imageMode?: boolean;
}>();
// defineEmits의 튜플은 이벤트 인수 타입이다. emit("save", 값)이 부모의 @save 핸들러로 전달된다.
const emit = defineEmits<{ save: [draft: RequirementDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "global" });
const emptyDraft = (): RequirementDraft => ({
  title: "",
  menuId: null,
  desired: "",
  reason: "",
  referenceText: "",
  similar: false,
  followParts: "",
});
// useForm<T>는 값·오류·dirty 상태를 묶는다. defineField가 돌려준 첫 ref를 v-model에 연결하며 script에서는 .value로 접근한다.
const form = useForm<RequirementDraft>({ initialValues: emptyDraft() });
const [title] = form.defineField("title");
const [menuId] = form.defineField("menuId");
const [desired] = form.defineField("desired");
const [reason] = form.defineField("reason");
const [referenceText] = form.defineField("referenceText");
const [similar] = form.defineField("similar");
const [followParts] = form.defineField("followParts");
const menuOptions = computed(() =>
  props.menus.map((menu) => ({
    value: String(menu.id),
    label: menu.name,
    disabled: menu.active !== 1 && menu.id !== props.initial?.menuId,
  })),
);
// Query 재조회와 언어 변경은 입력 초기화 사유가 아니다. 부모가 명시한 선택/저장/조회 키만 반영한다.
// watch는 감시 값이 바뀔 때 부수 효과를 실행한다. resetForm은 표시 값뿐 아니라 dirty/검증 기준도 새로 잡는다.
watch(
  () => props.resetKey,
  () => {
    const item = props.initial;
    form.resetForm({
      values: item
        ? {
            title: item.title,
            menuId: String(item.menuId),
            desired: item.desired,
            reason: item.reason,
            referenceText: item.referenceText,
            similar: item.similar === 1,
            followParts: item.followParts,
          }
        : emptyDraft(),
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
// 제출 → 중복/읽기 제한 확인 → safeParse 런타임 검증 → save 이벤트 순서다.
// success=false일 때는 필드 오류만 갱신하고 입력을 유지한다. 검증 성공도 DB 저장 성공을 의미하지 않는다.
function saveBody() {
  if (props.busy || props.readonly) return;
  clearErrors();
  const result = requirementSchema.safeParse(form.values);
  if (!result.success) {
    form.setErrors(schemaErrors(result.error.issues));
    return;
  }
  emit("save", result.data);
}
</script>

<style scoped>
.request-scope {
  color: var(--sc-color-text-muted);
}
</style>
