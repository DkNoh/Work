import { describe, expect, it } from "vitest";
import { adoSchema } from "./ado-schema";
describe("ADO 수동 링크 입력", () => {
  it("HTTP 링크와 티켓만 허용하고 인증정보/스크립트/역슬래시를 거절한다", () => {
    expect(
      adoSchema.safeParse({ ticket: "TASK_12-3", url: "https://example.test/tasks/12" }).success,
    ).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "https://user:pass@example.test/",
      "https://example.test\\path",
      " https://example.test/",
    ])
      expect(adoSchema.safeParse({ ticket: "12", url }).success).toBe(false);
    expect(adoSchema.safeParse({ ticket: "공백 티켓", url: "https://example.test/" }).success).toBe(
      false,
    );
  });
});
