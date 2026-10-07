import { z } from "zod";

export const exampleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
});
export type ExampleInput = z.input<typeof exampleSchema>;
