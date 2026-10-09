// 문서 제목과 편집기 JSON 구조를 검사한다. HTML 문자열을 허용하는 스키마가 아니며 공통 rich text 검증기를 재사용한다.
// Zod 스키마는 실행 시 존재하는 검증 코드다. TypeScript interface/type만 선언하면 브라우저 입력을 검증하지 못한다.
import { z } from "zod";
import { validateScRichTextDocument, type ScRichTextDocument } from "@sc/ui/editor";
export function documentSchema(
  required = "입력해 주세요.",
  maxTitle = "제목은 200자 이하입니다.",
  grammar = "허용된 문서 형식과 링크를 확인하세요.",
) {
  return z.object({
    title: z
      .string()
      .max(200, maxTitle)
      .refine((value) => value.trim().length > 0, required),
    // z.custom<T>의 T만으로는 검증되지 않는다. 아래 실제 validator 호출이 허용 노드·링크 문법을 검사한다.
    document: z.custom<ScRichTextDocument>(
      (value) => validateScRichTextDocument(value).valid,
      grammar,
    ),
  });
}
export interface DocumentDraft {
  title: string;
  document: ScRichTextDocument;
}
// 새 폼마다 새 객체를 만들어 반환한다. 같은 가변 편집기 문서를 여러 폼이 공유하지 않게 한다.
export function emptyDocument(): ScRichTextDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
