<template>
  <div
    v-bind="containerAttrs()"
    class="sc-rich-text-editor"
    :class="{
      'sc-rich-text-editor--disabled': disabled,
      'sc-rich-text-editor--error': errors.length > 0,
    }"
  >
    <div :id="`${fieldId}-label`" class="sc-rich-text-editor__label">{{ label }}</div>
    <div v-if="!readonly" class="sc-rich-text-editor__toolbar" role="group" :aria-label="label">
      <sc-action-button
        :disabled="disabled || !editor"
        :aria-pressed="editor?.isActive('bold') || false"
        variant="text"
        @click="applyFormat('bold')"
      >
        {{ labels.bold }}
      </sc-action-button>
      <sc-action-button
        :disabled="disabled || !editor"
        :aria-pressed="editor?.isActive('italic') || false"
        variant="text"
        @click="applyFormat('italic')"
      >
        {{ labels.italic }}
      </sc-action-button>
      <sc-action-button
        :disabled="disabled || !editor"
        :aria-pressed="editor?.isActive('bulletList') || false"
        variant="text"
        @click="applyFormat('bulletList')"
      >
        {{ labels.bulletList }}
      </sc-action-button>
      <sc-action-button
        :disabled="disabled || !editor?.can().undo()"
        variant="text"
        @click="applyFormat('undo')"
      >
        {{ labels.undo }}
      </sc-action-button>
      <sc-action-button
        :disabled="disabled || !editor?.can().redo()"
        variant="text"
        @click="applyFormat('redo')"
      >
        {{ labels.redo }}
      </sc-action-button>
    </div>
    <editor-content
      :editor="editor"
      class="sc-rich-text-editor__content"
      :class="{ 'sc-rich-text-editor__content--empty': editor?.isEmpty }"
      :data-placeholder="placeholder"
      :style="{ '--sc-editor-min-height': `${effectiveMinHeight}px` }"
    />
    <p v-if="hint" :id="`${fieldId}-hint`" class="sc-rich-text-editor__hint">{{ hint }}</p>
    <ul v-if="errors.length" :id="`${fieldId}-errors`" class="sc-rich-text-editor__errors">
      <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, useAttrs, useId, watch } from "vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import {
  fromEditorDocument,
  isScSafeLink,
  toEditorDocument,
  validateScRichTextDocument,
} from "./document";
import type {
  ScRichTextDocument,
  ScRichTextEditorProps,
  ScRichTextEditorEmits,
  ScRichTextEditorSlots,
} from "./contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScRichTextEditorProps>(), {
  id: undefined,
  disabled: false,
  readonly: false,
  errorMessages: "",
  hint: "",
  placeholder: "",
  toolbarLabels: () => ({}),
  minHeight: 180,
});
const emit = defineEmits<ScRichTextEditorEmits>();
defineSlots<ScRichTextEditorSlots>();
const attrs = useAttrs();
const localId = useId();
const fieldId = computed(() => props.id?.trim() || `sc-editor-${localId}`);
const initial = validateScRichTextDocument(props.modelValue);
const blank: ScRichTextDocument = { type: "doc", content: [{ type: "paragraph" }] };
const draft = initial.valid ? initial.document : blank;
let lastValidDocument = draft;
const errors = computed(() =>
  (typeof props.errorMessages === "string" ? [props.errorMessages] : props.errorMessages).filter(
    (message) => message.length > 0,
  ),
);
const labels = computed(() => ({
  bold: "굵게",
  italic: "기울임",
  bulletList: "글머리 기호",
  undo: "실행 취소",
  redo: "다시 실행",
  ...props.toolbarLabels,
}));
const effectiveMinHeight = computed(() =>
  Number.isFinite(props.minHeight) ? Math.max(80, props.minHeight) : 180,
);
function containerAttrs() {
  return pickScHtmlAttrs(attrs, {
    omit: [
      "role",
      "tabindex",
      "aria-labelledby",
      "aria-describedby",
      "aria-invalid",
      "aria-disabled",
      "aria-readonly",
    ],
  });
}
function inputAttributes(): Record<string, string> {
  const description = [
    props.hint ? `${fieldId.value}-hint` : "",
    errors.value.length ? `${fieldId.value}-errors` : "",
    typeof attrs["aria-describedby"] === "string" ? attrs["aria-describedby"] : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: fieldId.value,
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": [
      `${fieldId.value}-label`,
      typeof attrs["aria-labelledby"] === "string" ? attrs["aria-labelledby"] : "",
    ]
      .filter(Boolean)
      .join(" "),
    ...(description ? { "aria-describedby": description } : {}),
    ...(errors.value.length ? { "aria-invalid": "true" } : {}),
    "aria-disabled": String(props.disabled),
    "aria-readonly": String(props.readonly),
    tabindex: props.disabled ? "-1" : "0",
    "data-placeholder": props.placeholder,
    ...(props.placeholder ? { "aria-placeholder": props.placeholder } : {}),
  };
}
let lastInputAttributes = JSON.stringify(inputAttributes());
const editor = useEditor({
  content: toEditorDocument(draft),
  editable: !props.disabled && !props.readonly,
  extensions: [
    StarterKit.configure({
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        autolink: false,
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        isAllowedUri: (href) => isScSafeLink(href),
      },
    }),
  ],
  editorProps: { attributes: inputAttributes() },
  onUpdate: ({ editor: current }) => {
    if (props.disabled || props.readonly) return;
    try {
      const document = fromEditorDocument(current.getJSON());
      lastValidDocument = document;
      emit("update:modelValue", document);
    } catch (error) {
      current.commands.setContent(toEditorDocument(lastValidDocument), { emitUpdate: false });
      emit("invalid-document", {
        message: error instanceof Error ? error.message : "문서 형식이 올바르지 않습니다.",
      });
    }
  },
  onFocus: ({ event }) => emit("focus", event),
  onBlur: ({ event }) => emit("blur", event),
});
onMounted(() => {
  if (!initial.valid) emit("invalid-document", { message: initial.message });
});
watch(
  () => props.modelValue,
  (value) => {
    const checked = validateScRichTextDocument(value);
    if (!checked.valid) {
      emit("invalid-document", { message: checked.message });
      return;
    }
    const current = editor.value;
    if (!current) return;
    const next = toEditorDocument(checked.document);
    lastValidDocument = checked.document;
    if (JSON.stringify(fromEditorDocument(current.getJSON())) !== JSON.stringify(checked.document))
      current.commands.setContent(next, { emitUpdate: false });
  },
  { deep: true },
);
watch(
  () => [props.disabled, props.readonly],
  () => editor.value?.setEditable(!props.disabled && !props.readonly, false),
);
function syncInputAttributes() {
  const attributes = inputAttributes();
  const signature = JSON.stringify(attributes);
  if (signature === lastInputAttributes || !editor.value) return;
  lastInputAttributes = signature;
  editor.value.setOptions({ editorProps: { attributes } });
}
watch(
  [
    fieldId,
    errors,
    () => props.hint,
    () => props.placeholder,
    () => props.disabled,
    () => props.readonly,
  ],
  syncInputAttributes,
);
// useAttrs는 반응형 원본이 아니므로 attrs만 바뀐 부모 렌더도 공식 editorProps에 반영한다.
onUpdated(syncInputAttributes);
function applyFormat(command: "bold" | "italic" | "bulletList" | "undo" | "redo") {
  if (!editor.value || props.disabled || props.readonly) return;
  const chain = editor.value.chain().focus();
  if (command === "bold") chain.toggleBold().run();
  else if (command === "italic") chain.toggleItalic().run();
  else if (command === "bulletList") chain.toggleBulletList().run();
  else if (command === "undo") chain.undo().run();
  else chain.redo().run();
}
</script>

<style scoped lang="scss">
.sc-rich-text-editor {
  width: 100%;
  min-width: 0;
}
.sc-rich-text-editor__label {
  color: var(--sc-color-text);
  font-weight: 600;
  margin-bottom: var(--sc-space-2);
}
.sc-rich-text-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-1);
  margin-bottom: var(--sc-space-2);
}
.sc-rich-text-editor__content {
  position: relative;
}
.sc-rich-text-editor__content--empty::before {
  content: attr(data-placeholder);
  position: absolute;
  top: var(--sc-space-5);
  left: var(--sc-space-3);
  pointer-events: none;
  color: var(--sc-color-text-muted);
}
.sc-rich-text-editor__content :deep(.tiptap) {
  min-height: var(--sc-editor-min-height);
  padding: var(--sc-space-3);
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
  color: var(--sc-color-text);
  overflow-wrap: anywhere;
}
.sc-rich-text-editor__content :deep(.tiptap p) {
  margin-block: var(--sc-space-2);
}
.sc-rich-text-editor__content :deep(.tiptap:focus-visible) {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: 2px;
}
.sc-rich-text-editor__content :deep(.tiptap a) {
  color: var(--sc-color-primary);
  text-decoration: underline;
}
.sc-rich-text-editor--disabled :deep(.tiptap) {
  background: var(--sc-color-surface-muted);
}
.sc-rich-text-editor--error :deep(.tiptap) {
  border-color: var(--sc-color-error);
}
.sc-rich-text-editor__hint {
  color: var(--sc-color-text-muted);
  margin-top: var(--sc-space-2);
}
.sc-rich-text-editor__errors {
  color: var(--sc-color-error);
  padding-left: var(--sc-space-5);
  margin-top: var(--sc-space-2);
}
</style>
