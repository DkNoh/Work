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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * ScSelect/ScTextField를 VeeValidate 필드에 연결하며 submit 이벤트는 createScreen으로 처리한다.
 */

/**
 * 메뉴에 연결할 새 화면 메타데이터 생성 폼. 이미지 파일 업로드는 별도의 VersionUpload 컴포넌트가 맡는다.
 * 선택 UI 값은 문자열이므로 Zod transform(Number)로 ID를 변환하고 안전한 정수인지 검증한 뒤 API에 보낸다.
 * created 이벤트는 생성 결과를 부모 작업실에 전달한다. 부모는 목록 캐시를 갱신하고 새 화면의 URL을 선택한다.
 */

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
/**
 * 중복 제출 방지 → 이전 오류 제거 → safeParse → 서버 생성 → 폼 초기화/created 순서다. 서버 필드 오류는 ApiError.fields에서 복원한다.
 */
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
