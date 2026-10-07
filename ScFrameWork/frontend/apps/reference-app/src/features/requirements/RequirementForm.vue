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
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('request.save')"
      :show-cancel="false"
    />
  </form>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScFormActions, ScSelect, ScTextArea, ScTextField } from "@sc/ui";
import type { Menu, RequirementDetail } from "./api";
import { requirementSchema, schemaErrors, type RequirementDraft } from "./schema";

const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  menus: readonly Menu[];
  busy: boolean;
  readonly: boolean;
  serverErrors: Readonly<Record<string, string>>;
  imageMode?: boolean;
}>();
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
