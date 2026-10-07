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
