import type { ScBoardColumn, ScBoardMove } from "./contracts";

export function validateBoard<T>(
  columns: readonly ScBoardColumn<T>[],
  getKey: (item: T) => string,
): void {
  const groups = new Set<string>();
  const items = new Set<string>();
  for (const column of columns) {
    if (!column.id.trim() || !column.label.trim() || groups.has(column.id))
      throw new TypeError("열 ID와 이름은 비어 있지 않고 고유해야 합니다.");
    groups.add(column.id);
    for (const item of column.items) {
      const key = getKey(item);
      if (!key.trim() || items.has(key))
        throw new TypeError("항목 key는 전체 보드에서 고유해야 합니다.");
      items.add(key);
    }
  }
}
/** 변경 의도를 검증한다. 원본 배열이나 업무 상태를 변경하지 않는다. */
export function isBoardMove<T>(
  columns: readonly ScBoardColumn<T>[],
  getKey: (item: T) => string,
  move: ScBoardMove,
): boolean {
  const source = columns.find((column) => column.id === move.fromColumnId);
  const target = columns.find((column) => column.id === move.toColumnId);
  if (!source || !target || !source.items.some((item) => getKey(item) === move.itemKey))
    return false;
  if (move.beforeKey === move.itemKey) return false;
  if (move.beforeKey !== null && !target.items.some((item) => getKey(item) === move.beforeKey))
    return false;
  if (source === target) {
    const index = source.items.findIndex((item) => getKey(item) === move.itemKey);
    if ((source.items[index + 1] ? getKey(source.items[index + 1]!) : null) === move.beforeKey)
      return false;
  }
  return true;
}
