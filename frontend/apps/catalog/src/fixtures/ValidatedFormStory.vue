<template>
  <form novalidate class="sc-stack" aria-label="모의 저장 폼" @submit.prevent="saveInput">
    <sc-text-field
      v-model="title"
      label="제목"
      :error-messages="form.errors.value.title"
      :disabled="saving"
      required
    />
    <p v-if="failure" role="alert" aria-label="저장 오류">{{ failure }}</p>
    <p v-if="saved" role="status" aria-label="저장 결과">저장한 제목: {{ saved }}</p>
    <p role="status" aria-label="제출 횟수">{{ attempts }}</p>
    <sc-form-actions :busy="saving" @cancel="form.resetForm({ values: { title: '' } })" />
  </form>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 입력 오류·저장 오류·성공 결과와 제출 횟수를 보여 준다. 실제 form submit을 막고 safeParse 검증 후 모의 HTTP 저장을 실행한다.
 */

/*
 * VeeValidate가 폼 값/필드 오류를 소유하고 Zod4 safeParse를 직접 연결하는 소비 예제다. 호환되지 않는 schema adapter를 추가하지 않는다.
 *  Story 전용 memory runtime의 단일 client를 사용하며 /story-form은 MSW 합성 handler가 처리한다. 실제 계정/서버 자료는 사용하지 않는다.
 */
import { onBeforeUnmount, ref } from "vue";
import { createMemoryHistory } from "vue-router";
import { useForm } from "vee-validate";
import { z } from "zod";
import { ApiError, createFrameworkRuntime } from "@sc/runtime";
import { ScTextField, ScFormActions } from "@sc/ui";
const runtime = createFrameworkRuntime({ history: createMemoryHistory(), routes: [] });
const form = useForm<{ title: string }>({ initialValues: { title: "" } });
const [title] = form.defineField("title");
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
});
const saving = ref(false);
const failure = ref("");
const saved = ref("");
const attempts = ref(0);
let disposed = false;
// 중복 제출을 막고 검증 통과한 parsed.data만 전송한다. ApiError.fields는 폼 오류로 연결하며 실패 시 입력을 초기화하지 않는다.
async function saveInput() {
  if (saving.value) return;
  form.setErrors({ title: undefined });
  failure.value = "";
  saved.value = "";
  const parsed = schema.safeParse(form.values);
  if (!parsed.success) {
    form.setFieldError("title", parsed.error.issues[0]?.message);
    return;
  }
  saving.value = true;
  attempts.value++;
  try {
    const result = await runtime.client.request<{ title: string }>(
      "/story-form",
      "POST",
      parsed.data,
    );
    if (disposed) return;
    saved.value = result.title;
    form.resetForm({ values: { title: "" } });
  } catch (error) {
    if (disposed) return;
    if (error instanceof ApiError && error.fields.title)
      form.setFieldError("title", error.fields.title);
    failure.value = error instanceof Error ? error.message : String(error);
    // Promise 완료 시 Story가 이미 해제됐으면 화면 상태를 갱신하지 않는다.
  } finally {
    if (!disposed) saving.value = false;
  }
}
// dispose로 Story의 요청/Query/세션 수명을 끝내고 늦은 응답 처리도 disposed 플래그로 막는다.
onBeforeUnmount(() => {
  disposed = true;
  runtime.dispose();
});
</script>
