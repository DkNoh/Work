<template>
  <section class="sc-stack" aria-label="서식 입력 중립 예제">
    <div class="sc-inline">
      <sc-action-button @click="replaceDocument">부모 문서 교체</sc-action-button>
      <sc-action-button @click="rejectDocument">잘못된 문서 전달</sc-action-button>
    </div>
    <sc-rich-text-editor
      v-bind="props"
      :model-value="document"
      @update:model-value="editDocument"
      @blur="commitDocument"
      @invalid-document="invalidMessage = $event.message"
    />
    <pre aria-label="문서 JSON">{{ JSON.stringify(document) }}</pre>
    <p role="status" aria-label="문서 검증">{{ invalidMessage || "유효한 문서" }}</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공개 JSON 편집기와 현재 모델 미리보기를 표시한다. 부모 문서 교체/잘못된 링크 문서 버튼으로 입력 검증 경계를 재현한다.
 */

/*
 * document ref는 Story에서 부모 역할을 하는 모델이다. 사용자 편집은 즉시 반영하고 blur에서는 commit:modelValue를 상위 Story로 보낸다.
 *  Controls의 외부 문서 교체는 watch로 반영한다. type ScRichTextDocument는 JSON 형태를 검사하지만 링크 안전성 같은 실행 규칙은 공통 validator가 확인한다.
 */
import { ref, watch } from "vue";
import { ScActionButton } from "@sc/ui";
import {
  ScRichTextEditor,
  type ScRichTextDocument,
  type ScRichTextEditorProps,
} from "@sc/ui/editor";
const props = defineProps<ScRichTextEditorProps>();
const emit = defineEmits<{ "commit:modelValue": [document: ScRichTextDocument] }>();
const document = ref<ScRichTextDocument>(props.modelValue);
const invalidMessage = ref("");
function editDocument(value: ScRichTextDocument) {
  document.value = value;
}
function commitDocument() {
  emit("commit:modelValue", document.value);
}
watch(
  () => props.modelValue,
  (value) => {
    document.value = value;
  },
);
// 유효한 상대 링크가 포함된 새 객체를 전달해 외부 모델 변경을 편집기에 반영하는 경로를 확인한다.
function replaceDocument() {
  invalidMessage.value = "";
  document.value = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "부모에서 받은 새 문서",
            marks: [{ type: "link", attrs: { href: "/safe-guide" } }],
          },
        ],
      },
    ],
  };
}
// 명시적 부정 예제로 javascript 링크를 전달한다. 이는 실행용 링크가 아니라 invalid-document 이벤트와 기존 유효 문서 보존을 검사하는 입력이다.
function rejectDocument() {
  document.value = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "위험한 링크",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  };
}
</script>

<style scoped lang="scss">
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 100%;
}
</style>
