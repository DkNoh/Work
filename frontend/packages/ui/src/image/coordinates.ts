/*
 * 정규화 박스의 검증·경계 보정·두 점에서 박스 계산을 제공하는 순수 좌표 함수다. DOM이나 Vue 반응성 없이 사용할 수 있다.
 *  isNormalizedBox의 value is 타입 가드는 unknown을 검사한 성공 분기에서만 ScNormalizedBox로 사용할 수 있게 한다.
 */
import type { ScNormalizedBox } from "./contracts";
export function isNormalizedBox(value: unknown): value is ScNormalizedBox {
  if (!value || typeof value !== "object") return false;
  if (!("x" in value && "y" in value && "width" in value && "height" in value)) return false;
  const { x, y, width, height } = value;
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof width === "number" &&
    typeof height === "number" &&
    [x, y, width, height].every(Number.isFinite) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1 &&
    y + height <= 1
  );
}
// 이동/resize 결과를 이미지 안으로 보정한다. Number.EPSILON은 0 크기를 피하는 최소 양수 경계로 사용한다.
export function clampBox(box: ScNormalizedBox): ScNormalizedBox {
  const width = Math.min(1, Math.max(Number.EPSILON, box.width));
  const height = Math.min(1, Math.max(Number.EPSILON, box.height));
  return {
    x: Math.max(0, Math.min(1 - width, box.x)),
    y: Math.max(0, Math.min(1 - height, box.y)),
    width,
    height,
  };
}
// 어느 방향으로 드래그해도 시작점은 작은 x/y, 크기는 절댓값으로 만든다. 클릭처럼 넓이/높이가 0이면 null이다.
export function drawBox(
  start: { x: number; y: number },
  end: { x: number; y: number },
): ScNormalizedBox | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const box = { x, y, width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
  return isNormalizedBox(box) ? box : null;
}
