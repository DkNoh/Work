import { describe, expect, it } from "vitest";
import { isScSafeLink, validateScRichTextDocument } from "@sc/ui/editor";
import vectors from "../../../../../../backend/reference-app/src/test/resources/document-link-vectors.json";
import { documentSchema, emptyDocument } from "./schema";

describe("stored rich document grammar", () => {
  it("shares golden link vectors with the actual backend validator", () => {
    for (const vector of vectors)
      expect(isScSafeLink(vector.href), vector.href).toBe(vector.allowed);
  });
  it("rejects HTML nodes and accepts a valid empty paragraph", () => {
    expect(documentSchema().safeParse({ title: "doc", document: emptyDocument() }).success).toBe(
      true,
    );
    expect(
      documentSchema().safeParse({
        title: "doc",
        document: { type: "doc", content: [{ type: "image" }] },
      }).success,
    ).toBe(false);
    expect(
      validateScRichTextDocument({
        type: "doc",
        content: [{ type: "paragraph", attrs: { style: "x" } }],
      }).valid,
    ).toBe(false);
  });
});
