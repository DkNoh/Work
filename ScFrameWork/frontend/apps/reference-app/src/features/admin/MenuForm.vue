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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 기존 메뉴면 이름/순서/사용 여부를 수정하고 신규면 상위 메뉴를 선택한다. @submit.prevent가 saveMenu를 실행한다.
 */

// 메뉴 입력 컴포넌트는 이 파일에서 API 저장까지 수행한 뒤 saved 이벤트를 부모에게 보낸다. 부모는 목록 Query를 갱신한다.
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
// initial은 읽기 전용 메뉴 DTO다. null이면 신규 생성이며 readonly Menu[]는 선택지 배열을 자식에서 수정하지 않는 타입 계약이다.
const props = defineProps<{ initial: Menu | null; menus: readonly Menu[] }>();
// saved 이벤트에 최신 Menu를 실어 보낸다. 부모 AdminMenusPage의 @saved는 무효화와 폼 재생성을 담당한다.
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
// 현재 메뉴 목록에서 선택 옵션만 계산한다. value는 Select 계약에 맞춰 문자열 ID로 만든다.
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
// 중복 제출 방지 → Zod safeParse → 수정/생성 API 분기 → saved 이벤트 순서다.
// sortOrder는 문자열 입력을 정수로 변환하고 Java int 범위를 검사한다. 입력 타입 선언만으로 변환/검증되지는 않는다.
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
    // 기존 수정은 parentId를 보내지 않는다. 신규는 빈 상위 선택을 생략하고 값이 있을 때만 숫자 ID를 넣는다.
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
    // ApiError.fields를 VeeValidate 필드에 연결한다. 실패 시 form을 reset하지 않아 입력을 보존한다.
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("required");
    if (cause instanceof ApiError) form.setErrors(cause.fields);
  } finally {
    busy.value = false;
  }
}
</script>
