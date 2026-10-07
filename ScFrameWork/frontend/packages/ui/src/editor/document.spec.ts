import { describe, expect, it } from "vitest";
import {
  fromEditorDocument,
  isScSafeLink,
  toEditorDocument,
  validateScRichTextDocument,
} from "./document";

describe("공통 rich-text JSON schema", () => {
  it("node/mark/link 왕복에서 readonly 부모 자료를 복제하고 vendor 속성을 전파하지 않는다", () => {
    const original = Object.freeze({
      type: "doc",
      content: Object.freeze([
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            {
              type: "text",
              text: "한국어",
              marks: [{ type: "bold" }, { type: "link", attrs: { href: "/guide" } }],
            },
          ],
        },
      ]),
    });
    const checked = validateScRichTextDocument(original);
    expect(checked.valid).toBe(true);
    if (!checked.valid) throw new Error(checked.message);
    expect(checked.document).not.toBe(original);
    const roundTrip = fromEditorDocument(toEditorDocument(checked.document));
    expect(roundTrip).toEqual(original);
    expect(
      fromEditorDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "링크",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "https://example.test",
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
        ],
      }).content[0]?.content?.[0]?.marks,
    ).toEqual([{ type: "link", attrs: { href: "https://example.test" } }]);
  });
  it.each([
    "https://example.test/path",
    "http://example.test",
    "mailto:team@example.test",
    "/local",
    "../guide",
    "guide",
    "#part",
    "?page=2",
  ])("허용 링크 %s", (href) => {
    expect(isScSafeLink(href)).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "JaVaScRiPt:alert(1)",
    " javaScript:alert(1)",
    "java\nscript:alert(1)",
    "file:///tmp/test",
    "https:\\example.test",
    "",
  ])("차단 링크 %s", (href) => {
    expect(isScSafeLink(href)).toBe(false);
  });
  it("미지원 node·mark·unsafe href·잘못된 list/level을 거절한다", () => {
    const bad = [
      { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: 7 } }] },
      {
        type: "doc",
        content: [{ type: "bulletList", content: [{ type: "text", text: "잘못된 배치" }] }],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "링크",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "색상",
                marks: [{ type: "textStyle", attrs: { color: "red" } }],
              },
            ],
          },
        ],
      },
    ];
    for (const value of bad) expect(validateScRichTextDocument(value).valid).toBe(false);
  });
});
