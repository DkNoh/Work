import { z } from "zod";
export function noticeSchema(
  required = "입력해 주세요.",
  maxTitle = "제목은 200자 이하입니다.",
  maxBody = "본문은 50,000자 이하입니다.",
) {
  return z.object({
    title: z
      .string()
      .max(200, maxTitle)
      .refine((value) => value.trim().length > 0, required),
    content: z
      .string()
      .max(50_000, maxBody)
      .refine((value) => value.trim().length > 0, required),
  });
}
export interface NoticeDraft {
  title: string;
  content: string;
}
