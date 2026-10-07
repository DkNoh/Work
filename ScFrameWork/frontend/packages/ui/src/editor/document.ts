import type { JSONContent } from "@tiptap/core";
import type {
  ScRichTextDocument,
  ScRichTextMark,
  ScRichTextNode,
  ScRichTextValidation,
} from "./contracts";

export function isScSafeLink(href: string): boolean {
  if (
    !href ||
    href.trim() !== href ||
    href.includes("\\") ||
    [...href].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    return false;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  if (scheme) {
    if (!["http", "https", "mailto"].includes(scheme)) return false;
    try {
      const parsed = new URL(href);
      return scheme === "mailto" ? parsed.pathname.length > 0 : parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }
  return !href.includes(":");
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function assertKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("허용하지 않는 문서 속성입니다.");
}
function fail(message: string): never {
  throw new Error(message);
}
const blockTypes = new Set(["paragraph", "heading", "bulletList", "orderedList"]);
const simpleMarks = new Set(["bold", "italic", "underline", "strike", "code"]);

/** JSON shape·node/mark 문법·링크를 검증하고 부모의 읽기 전용 자료와 분리된 문서를 반환한다. */
export function validateScRichTextDocument(value: unknown): ScRichTextValidation {
  let nodeCount = 0;
  let textCount = 0;
  function node(raw: unknown, parent: string, depth: number): ScRichTextNode {
    if (!object(raw) || typeof raw.type !== "string")
      return fail("문서 node 형식이 올바르지 않습니다.");
    if (++nodeCount > 10_000 || depth > 32) return fail("문서 크기 또는 중첩 제한을 넘었습니다.");
    assertKeys(raw, ["type", "content", "text", "marks", "attrs"]);
    const type = raw.type;
    const allowed =
      parent === "doc" || parent === "listItem"
        ? blockTypes
        : parent === "bulletList" || parent === "orderedList"
          ? new Set(["listItem"])
          : new Set(["text", "hardBreak"]);
    if (!allowed.has(type)) return fail("허용하지 않는 node 또는 문서 배치입니다.");
    if (type === "text") {
      if (
        typeof raw.text !== "string" ||
        !raw.text ||
        raw.content !== undefined ||
        raw.attrs !== undefined
      )
        return fail("text node 형식이 올바르지 않습니다.");
      textCount += raw.text.length;
      if (textCount > 1_000_000) return fail("문서 글자 수 제한을 넘었습니다.");
      const marks: ScRichTextMark[] = [];
      if (raw.marks !== undefined) {
        if (!Array.isArray(raw.marks)) return fail("문서 mark 형식이 올바르지 않습니다.");
        const seen = new Set<string>();
        for (const mark of raw.marks) {
          if (!object(mark) || typeof mark.type !== "string" || seen.has(mark.type))
            return fail("문서 mark 형식이 올바르지 않습니다.");
          assertKeys(mark, ["type", "attrs"]);
          seen.add(mark.type);
          if (mark.type === "link") {
            if (!object(mark.attrs)) return fail("링크 주소가 필요합니다.");
            assertKeys(mark.attrs, ["href"]);
            if (typeof mark.attrs.href !== "string" || !isScSafeLink(mark.attrs.href))
              return fail("허용하지 않는 링크 주소입니다.");
            marks.push({ type: "link", attrs: { href: mark.attrs.href } });
          } else {
            if (!simpleMarks.has(mark.type) || mark.attrs !== undefined)
              return fail("허용하지 않는 mark입니다.");
            marks.push({ type: mark.type as Exclude<ScRichTextMark["type"], "link"> });
          }
        }
      }
      return { type: "text", text: raw.text, ...(marks.length ? { marks } : {}) };
    }
    if (raw.text !== undefined || raw.marks !== undefined)
      return fail("텍스트 이외의 node에 text/marks를 넣을 수 없습니다.");
    if (type === "hardBreak") {
      if (raw.content !== undefined || raw.attrs !== undefined)
        return fail("hardBreak node 형식이 올바르지 않습니다.");
      return { type: "hardBreak" };
    }
    const result: ScRichTextNode = { type: type as ScRichTextNode["type"] };
    let attrs: ScRichTextNode["attrs"];
    if (type === "heading") {
      if (!object(raw.attrs)) return fail("heading level이 필요합니다.");
      assertKeys(raw.attrs, ["level"]);
      if (
        typeof raw.attrs.level !== "number" ||
        !Number.isInteger(raw.attrs.level) ||
        raw.attrs.level < 1 ||
        raw.attrs.level > 6
      )
        return fail("heading level은 1~6입니다.");
      attrs = { level: raw.attrs.level as 1 | 2 | 3 | 4 | 5 | 6 };
    } else if (type === "orderedList" && raw.attrs !== undefined) {
      if (!object(raw.attrs)) return fail("orderedList start 형식이 올바르지 않습니다.");
      assertKeys(raw.attrs, ["start"]);
      if (
        typeof raw.attrs.start !== "number" ||
        !Number.isSafeInteger(raw.attrs.start) ||
        raw.attrs.start < 1
      )
        return fail("orderedList start는 양의 정수입니다.");
      attrs = { start: raw.attrs.start };
    } else if (raw.attrs !== undefined) return fail("허용하지 않는 node 속성입니다.");
    if (raw.content !== undefined && !Array.isArray(raw.content))
      return fail("content는 node 배열이어야 합니다.");
    const children =
      (raw.content as unknown[] | undefined)?.map((child) => node(child, type, depth + 1)) ?? [];
    if (
      (type === "bulletList" || type === "orderedList" || type === "listItem") &&
      !children.length
    )
      return fail("목록 내용이 필요합니다.");
    if (type === "listItem" && children[0]?.type !== "paragraph")
      return fail("목록 항목은 paragraph로 시작해야 합니다.");
    return {
      ...result,
      ...(attrs ? { attrs } : {}),
      ...(children.length ? { content: children } : {}),
    };
  }
  try {
    if (
      !object(value) ||
      value.type !== "doc" ||
      !Array.isArray(value.content) ||
      !value.content.length
    )
      return fail("문서는 내용이 있는 doc JSON이어야 합니다.");
    assertKeys(value, ["type", "content"]);
    return {
      valid: true,
      document: { type: "doc", content: value.content.map((child) => node(child, "doc", 1)) },
    };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : "문서 형식이 올바르지 않습니다.",
    };
  }
}

/** vendor의 기본 target/rel 등은 내부 렌더 설정이며 공통 JSON 계약으로 전파하지 않는다. */
export function fromEditorDocument(document: JSONContent): ScRichTextDocument {
  function clean(node: JSONContent): unknown {
    return {
      type: node.type,
      ...(node.text ? { text: node.text } : {}),
      ...(node.content?.length ? { content: node.content.map(clean) } : {}),
      ...(node.type === "heading" ? { attrs: { level: node.attrs?.level } } : {}),
      ...(node.type === "orderedList" ? { attrs: { start: node.attrs?.start ?? 1 } } : {}),
      ...(node.type === "text" && node.marks?.length
        ? {
            marks: node.marks.map((mark) => ({
              type: mark.type,
              ...(mark.type === "link" ? { attrs: { href: mark.attrs?.href } } : {}),
            })),
          }
        : {}),
    };
  }
  const checked = validateScRichTextDocument(clean(document));
  if (!checked.valid) throw new Error(checked.message);
  return checked.document;
}
export function toEditorDocument(document: ScRichTextDocument): JSONContent {
  return JSON.parse(JSON.stringify(document)) as JSONContent;
}
