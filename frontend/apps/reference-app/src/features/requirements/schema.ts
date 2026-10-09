// 본문과 검토의 브라우저 검증이다. 메뉴 선택은 문자열 ID로 입력받고 실제 API 숫자 변환은 부모 작업 화면이 수행한다.
// Zod 스키마는 실행 시 존재하는 검증 코드다. TypeScript interface/type만 선언하면 브라우저 입력을 검증하지 못한다.
import { z } from "zod";

const requiredText = (max: number) =>
  z
    .string()
    .max(max, `최대 ${max}자까지 입력할 수 있습니다.`)
    .refine((value) => value.trim().length > 0, "입력해 주세요.");
export const requirementSchema = z
  .object({
    title: requiredText(200),
    menuId: z
      .string()
      .nullable()
      .refine(
        (value) => !!value && Number.isSafeInteger(Number(value)) && Number(value) > 0,
        "메뉴를 선택해 주세요.",
      ),
    desired: requiredText(20000),
    reason: requiredText(10000),
    referenceText: z.string().max(10000),
    similar: z.boolean(),
    followParts: z.string().max(10000),
  })
  .refine((value) => !value.similar || !!value.followParts.trim(), {
    path: ["followParts"],
    message: "유사 기능에서 반영할 부분을 입력해 주세요.",
  });
// z.infer<typeof 스키마>는 검증 성공 결과의 TS 타입이다. safeParse의 success 분기로 오류와 data를 구분해서 사용한다.
export type RequirementDraft = z.infer<typeof requirementSchema>;
export const reviewSchema = z.object({
  decision: z.enum(["UNREVIEWED", "POSSIBLE", "CONDITIONAL", "MORE_INFO", "IMPOSSIBLE"]),
  rationale: requiredText(10000),
  conditions: z.string().max(10000),
  scope: z.string().max(10000),
  exclusions: z.string().max(10000),
  acceptance: z.string().max(10000),
  estimate: z.enum(["UNKNOWN", "SMALL", "MEDIUM", "LARGE"]),
  needsInfo: z.boolean(),
});
export type ReviewDraft = z.infer<typeof reviewSchema>;
export const commentSchema = z.object({ body: requiredText(10000) });

// 이 기능의 오류는 첫 경로(필드명) 기준으로 묶는다. 중첩 필드를 점 표기로 합치는 shared/validation과 동작 범위가 다르다.
export function schemaErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fields[field]) fields[field] = issue.message;
  }
  return fields;
}
