/*
 * 저장 가능한 서식 문서의 공통 JSON schema를 TypeScript로 표현한다. 재귀적인 ScRichTextNode.content는 Java 트리 DTO와 비슷하다.
 *  link mark만 href attrs를 가지는 union이며, valid:true/false 결과도 판별 필드로 나뉜다. if(result.valid) 뒤에는 document에 안전하게 접근할 수 있다.
 *  readonly 타입은 작성 중 코드 실수를 줄이는 장치다. 외부 JSON의 실제 형태/크기/링크 검증은 document.ts가 수행한다.
 */
export type ScRichTextMark =
  | { readonly type: "bold" | "italic" | "underline" | "strike" | "code" }
  | { readonly type: "link"; readonly attrs: { readonly href: string } };
export interface ScRichTextNode {
  readonly type:
    "paragraph" | "text" | "bulletList" | "orderedList" | "listItem" | "hardBreak" | "heading";
  readonly content?: readonly ScRichTextNode[];
  readonly text?: string;
  readonly marks?: readonly ScRichTextMark[];
  readonly attrs?: { readonly level?: 1 | 2 | 3 | 4 | 5 | 6; readonly start?: number };
}
export interface ScRichTextDocument {
  readonly type: "doc";
  readonly content: readonly ScRichTextNode[];
}
export interface ScEditorToolbarLabels {
  bold?: string;
  italic?: string;
  bulletList?: string;
  undo?: string;
  redo?: string;
}
export interface ScRichTextEditorProps {
  modelValue: ScRichTextDocument;
  label: string;
  id?: string;
  disabled?: boolean;
  readonly?: boolean;
  errorMessages?: string | readonly string[];
  hint?: string;
  placeholder?: string;
  toolbarLabels?: ScEditorToolbarLabels;
  minHeight?: number;
}
export interface ScRichTextEditorEmits {
  "update:modelValue": [document: ScRichTextDocument];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
  "invalid-document": [error: { message: string }];
}
export type ScRichTextEditorSlots = Record<string, never>;
export type ScRichTextValidation =
  { valid: true; document: ScRichTextDocument } | { valid: false; message: string };
