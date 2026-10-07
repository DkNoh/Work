<template>
  <form class="sc-stack" novalidate :aria-label="t('createScreen')" @submit.prevent="createScreen">
    <sc-select
      v-model="menuId"
      :label="t('menu')"
      :options="menuOptions"
      :error-messages="form.errors.value.menuId"
      :disabled="busy"
      required
    />
    <sc-text-field
      v-model="name"
      :label="t('name')"
      :error-messages="form.errors.value.name"
      :disabled="busy"
      :max-length="200"
      required
    />
    <p v-if="error" role="alert">{{ error }}</p>
    <sc-form-actions :submit-label="t('createScreen')" :busy="busy" :show-cancel="false" />
  </form>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { z } from "zod";
import { ApiError } from "@sc/runtime";
import { ScSelect, ScTextField, ScFormActions } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { formIssueMessages } from "../../shared/validation";
import type { Menu } from "../requirements/api";
import { createMediaApi, type Screen } from "./api";
import { mediaMessages } from "./messages";
const props = defineProps<{ menus: readonly Menu[] }>();
const emit = defineEmits<{ created: [screen: Screen] }>();
const { t } = useI18n({ useScope: "local", messages: mediaMessages });
const runtime = useReferenceRuntime();
const api = createMediaApi(runtime);
const form = useForm({ initialValues: { menuId: "", name: "" } });
const [menuId] = form.defineField("menuId");
const [name] = form.defineField("name");
const menuOptions = computed(() =>
  props.menus
    .filter((menu) => menu.active === 1)
    .map((menu) => ({ value: String(menu.id), label: menu.name })),
);
const busy = ref(false);
const error = ref("");
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
async function createScreen() {
  if (busy.value) return;
  error.value = "";
  form.setErrors({ menuId: undefined, name: undefined });
  const parsed = z
    .object({
      menuId: z
        .string()
        .regex(/^[1-9]\d*$/, t("required"))
        .transform(Number)
        .refine(Number.isSafeInteger, t("required")),
      name: z
        .string()
        .min(1)
        .max(200)
        .refine((value) => !!value.trim(), t("required")),
    })
    .safeParse(form.values);
  if (!parsed.success) {
    form.setErrors(formIssueMessages(parsed.error.issues));
    return;
  }
  busy.value = true;
  try {
    const screen = await api.createScreen(parsed.data);
    if (!disposed) {
      form.resetForm();
      emit("created", screen);
    }
  } catch (cause) {
    if (!disposed) {
      error.value = cause instanceof Error ? cause.message : t("required");
      if (cause instanceof ApiError) form.setErrors(cause.fields);
    }
  } finally {
    if (!disposed) busy.value = false;
  }
}
</script>
