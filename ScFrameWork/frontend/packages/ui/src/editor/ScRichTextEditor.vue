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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 이름·서식 toolbar·실제 editor content·hint·오류 목록을 표시한다. readonly에서는 toolbar를 숨기고 본문 읽기를 유지한다.
 * toolbar 버튼의 aria-pressed는 현재 선택 영역의 서식 상태를 표시하며 저장 API는 호출하지 않는다.
 */

/*
 * 부모가 가진 공통 JSON 문서와 Tiptap의 편집 상태를 연결하는 어댑터다. HTML 문자열을 v-html로 삽입하지 않는다.
 *  모델은 props, 사용자 편집 결과는 update:modelValue emit이다. 편집기의 유효한 직전 문서는 허용되지 않는 입력을 되돌릴 때만 보관한다.
 *  computed는 표시 문구/오류/높이를 계산하고 watch는 부모 변경을 외부 편집기 인스턴스에 적용하는 부수 효과를 맡는다.
 */
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
// 최초 입력도 런타임 검증한다. 잘못된 문서는 빈 paragraph로 시작하고 mount 후 invalid-document를 부모에 알린다.
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
// 실제 contenteditable 요소에 label/hint/error ARIA를 연결한다. 바깥 div에만 붙이면 입력의 접근성 이름이 연결되지 않는다.
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
// useEditor가 편집기 인스턴스 생성을 관리한다. StarterKit의 허용 기능을 제한해 공통 JSON 문법과 일치시킨다.
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
  // vendor JSON을 공통 문서로 정리·검증한 뒤 emit한다. 실패하면 마지막 유효 문서로 복원하되 emitUpdate:false로 재귀 갱신을 막는다.
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
// 부모의 서버 재조회/초기화가 새 모델을 주면 편집기로 반영한다. 같은 문서를 재설정하지 않아 커서/undo 상태의 불필요한 초기화를 줄인다.
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
// readonly/disabled는 Vue DOM 속성뿐 아니라 편집기 자체의 editable 모드에도 반영해야 키보드 편집이 차단된다.
watch(
  () => [props.disabled, props.readonly],
  () => editor.value?.setEditable(!props.disabled && !props.readonly, false),
);
// ARIA 속성 변경을 편집기 공식 API에 전달한다. 동일한 JSON signature는 건너뛰어 렌더 → 옵션 변경의 불필요한 반복을 줄인다.
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
// 허용된 명령 union만 받아 editor chain으로 실행한다. focus 후 명령을 적용해 toolbar 클릭으로 본문 선택 위치가 사라지지 않게 한다.
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
