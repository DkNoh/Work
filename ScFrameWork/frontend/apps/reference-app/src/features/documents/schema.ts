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
export function emptyDocument(): ScRichTextDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
