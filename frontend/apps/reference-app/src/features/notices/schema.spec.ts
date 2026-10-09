import { describe, expect, it } from "vitest";
import { noticeSchema } from "./schema";

describe("plain notice input", () => {
  it("preserves whitespace and treats apparent HTML as plain text", () => {
    const value = { title: " title ", content: " <p>text</p>\n " };
    expect(noticeSchema().parse(value)).toEqual(value);
  });
  it("requires body text and enforces the original length contract", () => {
    expect(noticeSchema().safeParse({ title: "ok", content: " \n " }).success).toBe(false);
    expect(noticeSchema().safeParse({ title: "ok", content: "x".repeat(50_000) }).success).toBe(
      true,
    );
    expect(noticeSchema().safeParse({ title: "ok", content: "x".repeat(50_001) }).success).toBe(
      false,
    );
  });
});
