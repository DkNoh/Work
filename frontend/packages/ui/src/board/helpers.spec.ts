import { describe, expect, it } from "vitest";
import { isBoardMove, validateBoard } from "./helpers";
const columns = Object.freeze([
  { id: "a", label: "첫 열", items: Object.freeze([{ id: "one" }, { id: "two" }]) },
  { id: "b", label: "빈 열", items: Object.freeze([]) },
]);
const key = (item: { id: string }) => item.id;
describe("보드 이동 의도와 원본 경계", () => {
  it("빈 열 끝 이동을 허용하며 같은 위치/자기 참조/없는 기준을 거절한다", () => {
    expect(
      isBoardMove(columns, key, {
        itemKey: "one",
        fromColumnId: "a",
        toColumnId: "b",
        beforeKey: null,
      }),
    ).toBe(true);
    expect(
      isBoardMove(columns, key, {
        itemKey: "one",
        fromColumnId: "a",
        toColumnId: "a",
        beforeKey: "two",
      }),
    ).toBe(false);
    expect(
      isBoardMove(columns, key, {
        itemKey: "one",
        fromColumnId: "a",
        toColumnId: "a",
        beforeKey: "one",
      }),
    ).toBe(false);
    expect(
      isBoardMove(columns, key, {
        itemKey: "one",
        fromColumnId: "a",
        toColumnId: "b",
        beforeKey: "missing",
      }),
    ).toBe(false);
    expect(columns[0]!.items.map(key)).toEqual(["one", "two"]);
  });
  it("열 사이 중복 key와 빈 열 식별자를 거절한다", () => {
    expect(() =>
      validateBoard([...columns, { id: "c", label: "중복", items: [{ id: "one" }] }], key),
    ).toThrow(TypeError);
    expect(() => validateBoard([{ id: "", label: "빈 ID", items: [] }], key)).toThrow(TypeError);
    expect(() => validateBoard(columns, key)).not.toThrow();
  });
});
