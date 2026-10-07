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
