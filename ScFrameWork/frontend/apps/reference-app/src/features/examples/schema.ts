// 제목을 trim한 뒤 길이를 검사한다. z.input은 변환 전 입력 타입이고 safeParse 성공 data는 trim이 적용된 결과다.
// Zod 스키마는 실행 시 존재하는 검증 코드다. TypeScript interface/type만 선언하면 브라우저 입력을 검증하지 못한다.
import { z } from "zod";

export const exampleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
});
// typeof는 위 스키마 변수의 타입을 참조한다. z.input<...>으로 입력 구조를 추론해 별도 DTO 선언과의 불일치를 줄인다.
export type ExampleInput = z.input<typeof exampleSchema>;
