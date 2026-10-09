/*
 * 보드의 key 유일성과 이동 의도의 구조를 검사하는 순수 helper다. DOM·드래그 센서·서버 권한 판단을 포함하지 않는다.
 *  validateBoard는 잘못된 표시 자료를 예외로 알리고, isBoardMove는 가능한 변화인지 boolean으로 반환한다. 원본 배열을 수정하지 않는다.
 */
import type { ScBoardColumn, ScBoardMove } from "./contracts";

// Set 두 개로 열과 항목 키를 따로 검사한다. 항목 key는 같은 열 안뿐 아니라 전체 보드에서 유일해야 한다.
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
  // 같은 열에서 이미 같은 다음 항목 앞에 있다면 변화가 없다. no-op 이동을 막아 불필요한 저장 요청을 줄인다.
  if (source === target) {
    const index = source.items.findIndex((item) => getKey(item) === move.itemKey);
    if ((source.items[index + 1] ? getKey(source.items[index + 1]!) : null) === move.beforeKey)
      return false;
  }
  return true;
}
