/*
 * @sc/ui/editor 진입점: JSON 편집기·공통 문서 validator·링크 검사와 문서 타입을 공개한다. Tiptap JSON 변환과 vendor 설정은 내부로 남긴다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScRichTextEditor } from "./ScRichTextEditor.vue";
export { validateScRichTextDocument, isScSafeLink } from "./document";
export type {
  ScRichTextDocument,
  ScRichTextNode,
  ScRichTextMark,
  ScRichTextValidation,
  ScEditorToolbarLabels,
  ScRichTextEditorProps,
  ScRichTextEditorEmits,
  ScRichTextEditorSlots,
} from "./contracts";
