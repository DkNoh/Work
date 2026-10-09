<template>
  <div class="sc-stack">
    <!-- v-for는 서버 댓글 배열을 반복하고 :key=id는 각 DOM 항목의 동일성을 유지한다. {{ }}는 본문을 HTML로 실행하지 않고 텍스트로 출력한다. -->
    <ol class="comments-list" :aria-label="t('request.comments')">
      <li v-for="comment in comments" :key="comment.id">
        <p class="comment-meta">{{ comment.authorName }} · {{ formatDate(comment.createdAt) }}</p>
        <p class="comment-body">{{ comment.body }}</p>
      </li>
    </ol>
    <p v-if="comments.length === 0">{{ t("request.noComments") }}</p>
    <form
      novalidate
      class="sc-stack"
      :aria-label="t('request.commentForm')"
      @submit.prevent="addComment"
    >
      <sc-text-area
        v-model="body"
        :label="t('request.commentBody')"
        :error-messages="form.errors.value.body"
        :disabled="busy"
        :max-length="10000"
        required
      />
      <!-- 공통 액션 컴포넌트가 submit 버튼을 표시한다. busy는 조작 표시이고 서버 권한 검사는 별도로 수행된다. -->
      <sc-form-actions :busy="busy" :submit-label="t('request.addComment')" :show-cancel="false" />
    </form>
  </div>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 댓글 입력 영역. v-model은 폼 필드와 연결하고 @submit.prevent는 전체 페이지 전송을 막아 addComment를 실행한다.
 */

// 댓글의 입력/검증을 맡는 자식 컴포넌트다. API 호출과 저장 후 Query 갱신은 부모 화면이 맡는다.
// <script setup>의 최상위 변수/함수는 template에서 사용할 수 있고, TS 타입은 빌드 시 제거된다.
import { watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScFormActions, ScTextArea } from "@sc/ui";
import type { RequirementDetail } from "./api";
import { commentSchema, schemaErrors } from "./schema";
// props.comments는 읽기 전용 서버 댓글 목록이다. 새 댓글은 useForm의 독립 body 입력에 작성한다.
// resetKey는 부모가 선택 변경/저장 성공/명시적 최신 조회를 승인했다는 신호이며 일반 재조회만으로 입력을 덮지 않는다.
const props = defineProps<{
  comments: RequirementDetail["comments"];
  resetKey: number;
  busy: boolean;
  serverErrors: Readonly<Record<string, string>>;
  formatDate: (value: string | null) => string;
}>();
// defineEmits의 튜플은 이벤트 인수 타입이다. emit("add", 값)이 부모의 @add 핸들러로 전달된다.
const emit = defineEmits<{ add: [body: string]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "global" });
// useForm<T>는 값·오류·dirty 상태를 묶는다. defineField가 돌려준 첫 ref를 v-model에 연결하며 script에서는 .value로 접근한다.
const form = useForm<{ body: string }>({ initialValues: { body: "" } });
const [body] = form.defineField("body");
// watch는 감시 값이 바뀔 때 부수 효과를 실행한다. resetForm은 표시 값뿐 아니라 dirty/검증 기준도 새로 잡는다.
watch(
  () => props.resetKey,
  () => form.resetForm({ values: { body: "" } }),
);
// 서버 ApiError.fields는 부모를 통해 전달된다. 필드 오류를 form에 붙이면 template의 error-messages로 표시된다.
watch(
  () => props.serverErrors,
  (errors) => {
    form.setFieldError("body", undefined);
    form.setErrors(errors);
  },
);
// dirty를 이벤트로 올려 부모의 이동 확인/다른 저장 채널과 연결한다. ref를 서버 세션에 저장하는 동작은 아니다.
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
// 제출 → busy로 중복 제출 방지 → safeParse 런타임 검증 → add 이벤트 순서다.
// success=false일 때는 필드 오류만 갱신하고 입력을 유지한다. 검증 성공도 DB 저장 성공을 의미하지 않는다.
function addComment() {
  if (props.busy) return;
  form.setFieldError("body", undefined);
  const result = commentSchema.safeParse(form.values);
  if (!result.success) {
    form.setErrors(schemaErrors(result.error.issues));
    return;
  }
  emit("add", result.data.body);
}
</script>

<style scoped>
.comments-list {
  margin: 0;
  padding-left: var(--sc-space-6);
}
.comment-meta {
  color: var(--sc-color-text-muted);
}
.comment-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
