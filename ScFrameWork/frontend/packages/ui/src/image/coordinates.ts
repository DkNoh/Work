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
export function drawBox(
  start: { x: number; y: number },
  end: { x: number; y: number },
): ScNormalizedBox | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const box = { x, y, width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
  return isNormalizedBox(box) ? box : null;
}
