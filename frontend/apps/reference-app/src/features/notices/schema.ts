// 공지의 제목/평문 본문 길이와 공백뿐인 입력을 검사한다. refine은 거절 조건을 추가하지만 원문의 공백을 자동 삭제하지 않는다.
// Zod 스키마는 실행 시 존재하는 검증 코드다. TypeScript interface/type만 선언하면 브라우저 입력을 검증하지 못한다.
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
