import { describe, expect, it } from "vitest";
import { exampleSchema } from "./schema";

describe("예제 업무 입력", () => {
  it("공백 제목과 200자 초과를 거절한다", () => {
    expect(exampleSchema.safeParse({ title: "  " }).success).toBe(false);
    expect(exampleSchema.safeParse({ title: "가".repeat(201) }).success).toBe(false);
  });
  it("성공 결과는 저장할 정규화 자료다", () => {
    expect(exampleSchema.parse({ title: "  합성 예제  " })).toEqual({ title: "합성 예제" });
  });
});
