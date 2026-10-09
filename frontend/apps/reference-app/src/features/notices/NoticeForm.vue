<template>
  <form novalidate class="sc-stack" :aria-label="t('notice.form')" @submit.prevent="saveDraft">
    <sc-text-field
      v-model="title"
      name="title"
      :label="t('notice.title')"
      :error-messages="form.errors.value.title"
      :readonly="readonly"
      :disabled="busy"
      :max-length="200"
      required
    />
    <sc-text-area
      v-model="content"
      name="content"
      :label="t('notice.body')"
      :error-messages="form.errors.value.content"
      :readonly="readonly"
      :disabled="busy"
      :max-length="50000"
      :rows="8"
      required
    />
    <!-- 공통 액션 컴포넌트가 submit 버튼을 표시한다. busy/readonly는 조작 표시이고 서버 권한 검사는 별도로 수행된다. -->
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('notice.save')"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공지 입력 영역. v-model은 폼 필드와 연결하고 @submit.prevent는 전체 페이지 전송을 막아 saveDraft를 실행한다.
 */

// 공지의 입력/검증을 맡는 자식 컴포넌트다. API 호출과 저장 후 Query 갱신은 부모 화면이 맡는다.
// <script setup>의 최상위 변수/함수는 template에서 사용할 수 있고, TS 타입은 빌드 시 제거된다.
import { watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { noticeScopedMessages } from "./messages";
import { ScTextField, ScFormActions, ScTextArea } from "@sc/ui";

import type { NoticeResponse } from "./api";
import { noticeSchema, type NoticeDraft } from "./schema";
import { formIssueMessages } from "../../shared/validation";
// props는 부모가 내려주는 읽기 전용 계약이다. initial을 직접 수정하지 않고 useForm의 별도 입력에 복사한다.
// resetKey는 부모가 선택 변경/저장 성공/명시적 최신 조회를 승인했다는 신호이며 일반 재조회만으로 입력을 덮지 않는다.
const props = defineProps<{
  initial: NoticeResponse | null;
  resetKey: number;
  busy: boolean;
  readonly?: boolean;
  serverErrors: Record<string, string>;
}>();
// defineEmits의 튜플은 이벤트 인수 타입이다. emit("save", 값)이 부모의 @save 핸들러로 전달된다.
const emit = defineEmits<{ save: [draft: NoticeDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: noticeScopedMessages });
// useForm<T>는 값·오류·dirty 상태를 묶는다. defineField가 돌려준 첫 ref를 v-model에 연결하며 script에서는 .value로 접근한다.
const form = useForm<NoticeDraft>({ initialValues: { title: "", content: "" } });
// 서버 필드 오류의 소유자는 명시적 Zod/API 검증이다. 모델 입력만으로 오류를 지우지 않는다.
const [title] = form.defineField("title", { validateOnModelUpdate: false });
const [content] = form.defineField("content", { validateOnModelUpdate: false });

// watch는 감시 값이 바뀔 때 부수 효과를 실행한다. resetForm은 표시 값뿐 아니라 dirty/검증 기준도 새로 잡는다.
watch(
  () => props.resetKey,
  () => {
    form.resetForm({
      values: { title: props.initial?.title ?? "", content: props.initial?.content ?? "" },
    });
  },
  { immediate: true },
);
// 서버 ApiError.fields는 부모를 통해 전달된다. 필드 오류를 form에 붙이면 template의 error-messages로 표시된다.
watch(
  () => props.serverErrors,
  (errors) => {
    form.setErrors({ title: errors.title, content: errors.content });
  },
);
// dirty를 이벤트로 올려 부모의 이동 확인/다른 저장 채널과 연결한다. ref를 서버 세션에 저장하는 동작은 아니다.
watch(
  () => form.meta.value.dirty,
  (value) => emit("dirty-change", value),
  { immediate: true },
);
// 제출 → 중복/읽기 제한 확인 → safeParse 런타임 검증 → save 이벤트 순서다.
// success=false일 때는 필드 오류만 갱신하고 입력을 유지한다. 검증 성공도 DB 저장 성공을 의미하지 않는다.
function saveDraft() {
  if (props.busy || props.readonly) return;
  form.setErrors({ title: undefined, content: undefined });
  const result = noticeSchema(
    t("notice.required"),
    t("notice.maxTitle"),
    t("notice.maxBody"),
  ).safeParse(form.values);
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  emit("save", result.data);
}
</script>
