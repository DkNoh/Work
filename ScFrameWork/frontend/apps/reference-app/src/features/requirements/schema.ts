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

export function schemaErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fields[field]) fields[field] = issue.message;
  }
  return fields;
}
