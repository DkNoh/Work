<template>
  <form
    class="sc-stack"
    novalidate
    :aria-label="t(initial ? 'editMenu' : 'createMenu')"
    @submit.prevent="saveMenu"
  >
    <sc-text-field
      v-model="name"
      :label="t('menuName')"
      :error-messages="form.errors.value.name"
      :disabled="busy"
      required
      :max-length="120"
    />
    <sc-text-field
      v-model="sortOrder"
      :label="t('order')"
      :error-messages="form.errors.value.sortOrder"
      :disabled="busy"
      inputmode="numeric"
      required
    />
    <sc-select
      v-if="!initial"
      v-model="parentId"
      :label="t('parent')"
      :options="parentOptions"
      :disabled="busy"
    />
    <sc-checkbox v-else v-model="active" :label="t('active')" :disabled="busy" />
    <p v-if="error" role="alert">{{ error }}</p>
    <sc-form-actions
      :submit-label="t(initial ? 'save' : 'createMenu')"
      :busy="busy"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { ScTextField, ScSelect, ScCheckbox, ScFormActions } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { formIssueMessages } from "../../shared/validation";
import { createAdminApi, type Menu } from "./api";
import { adminMessages } from "./messages";
const props = defineProps<{ initial: Menu | null; menus: readonly Menu[] }>();
const emit = defineEmits<{ saved: [menu: Menu] }>();
const { t } = useI18n({ useScope: "local", messages: adminMessages });
const runtime = useReferenceRuntime();
const api = createAdminApi(runtime);
// 부모가 선택/성공 시에만 key를 바꾼다. Query 재조회는 작성 중인 폼을 초기화하지 않는다.
const form = useForm({
  initialValues: {
    name: props.initial?.name ?? "",
    sortOrder: String(props.initial?.sortOrder ?? 0),
    parentId: "",
    active: props.initial?.active === 1,
  },
});
const [name] = form.defineField("name");
const [sortOrder] = form.defineField("sortOrder");
const [parentId] = form.defineField("parentId");
const [active] = form.defineField("active");
const parentOptions = computed(() => [
  { value: "", label: t("noParent") },
  ...props.menus.map((menu) => ({
    value: String(menu.id),
    label: menu.name,
    disabled: menu.active !== 1,
  })),
]);
const busy = ref(false);
const error = ref("");
async function saveMenu() {
  if (busy.value) return;
  error.value = "";
  form.setErrors({ name: undefined, sortOrder: undefined, parentId: undefined });
  const result = z
    .object({
      name: z
        .string()
        .min(1)
        .max(120)
        .refine((value) => !!value.trim(), t("required")),
      sortOrder: z
        .string()
        .regex(/^-?\d+$/, t("required"))
        .transform(Number)
        .refine(
          (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647,
          t("required"),
        ),
      parentId: z
        .string()
        .refine(
          (value) =>
            value === "" || (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))),
          t("required"),
        ),
      active: z.boolean(),
    })
    .safeParse(form.values);
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  busy.value = true;
  try {
    const value = result.data;
    const menu = props.initial
      ? await api.saveMenu(props.initial.id, {
          name: value.name,
          sortOrder: value.sortOrder,
          active: value.active,
        })
      : await api.createMenu({
          name: value.name,
          sortOrder: value.sortOrder,
          ...(value.parentId ? { parentId: Number(value.parentId) } : {}),
        });
    emit("saved", menu);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("required");
    if (cause instanceof ApiError) form.setErrors(cause.fields);
  } finally {
    busy.value = false;
  }
}
</script>
