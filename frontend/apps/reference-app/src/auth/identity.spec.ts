import { describe, expect, it } from "vitest";
import { decodeReferenceIdentity } from "./identity";
describe("reference session adapter", () => {
  it("derives internal roles while keeping original business fields", () => {
    expect(
      decodeReferenceIdentity({
        id: 7,
        username: "reviewer",
        displayName: "검토자",
        role: "REVIEWER",
      }),
    ).toEqual({
      id: 7,
      username: "reviewer",
      displayName: "검토자",
      role: "REVIEWER",
      roles: ["REVIEWER"],
    });
  });
  it("rejects invalid ids, missing original fields and coercible roles instead of accepting a session", () => {
    for (const value of [
      null,
      [],
      { id: 0, username: "user", displayName: "사용자", role: "REQUESTER" },
      { id: 1, username: "user", role: "ADMIN" },
      { id: 1, username: "user", displayName: "사용자", role: { toString: () => "ADMIN" } },
      { id: 1, username: "user", displayName: "사용자", role: "OTHER" },
    ])
      expect(() => decodeReferenceIdentity(value)).toThrow("Invalid reference identity");
  });
});
