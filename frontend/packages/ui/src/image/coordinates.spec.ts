import { describe, expect, it } from "vitest";
import { clampBox, drawBox, isNormalizedBox } from "./coordinates";
describe("원본 이미지 정규화 좌표", () => {
  it("역방향 포인터도 같은 박스를 만들며 빈 클릭은 저장하지 않는다", () => {
    expect(drawBox({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.6000000000000001,
      height: 0.6,
    });
    expect(drawBox({ x: 0.2, y: 0.1 }, { x: 0.2, y: 0.1 })).toBeNull();
  });
  it("NaN/무한/경계 밖/영 크기는 거절하고 이동 크기를 유지한다", () => {
    for (const box of [
      { x: NaN, y: 0, width: 0.1, height: 0.1 },
      { x: 0, y: 0, width: Infinity, height: 0.1 },
      { x: 0.9, y: 0, width: 0.2, height: 0.1 },
      { x: 0, y: 0, width: 0, height: 0.1 },
    ])
      expect(isNormalizedBox(box)).toBe(false);
    const source = Object.freeze({ x: 0.95, y: -0.1, width: 0.2, height: 0.3 });
    expect(clampBox(source)).toEqual({ x: 0.8, y: 0, width: 0.2, height: 0.3 });
    expect(source.x).toBe(0.95);
  });
});
