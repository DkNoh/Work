/*
 * 표/가상 목록 Story가 재사용하는 합성 행·컬럼·key/label 콜백이다. 운영 DB나 Reference 자료를 읽지 않는다.
 *  ScTableColumn<TableExampleRow> generic 덕분에 value 콜백에서 실제 행 필드만 사용할 수 있다.
 *  createTableExampleRows는 지정 수만큼 안정적인 문자열 ID를 만들고 long일 때 일부 행을 여러 줄로 만들어 가변 높이 측정을 확인한다.
 */
import type { ScTableColumn } from "@sc/ui/table";

export interface TableExampleRow {
  id: string;
  title: string;
  amount: number;
}
export const tableExampleColumns: readonly ScTableColumn<TableExampleRow>[] = [
  { id: "title", label: "제목", value: (row) => row.title },
  { id: "amount", label: "금액", value: (row) => row.amount, sortable: true },
];
export const tableExampleKey = (row: TableExampleRow) => row.id;
export const tableExampleLabel = (row: TableExampleRow) => row.title;
export function createTableExampleRows(count: number, long = false): TableExampleRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${String(index).padStart(5, "0")}`,
    title: `자료 ${index}${long && index % 11 === 0 ? " · 긴 한국어 제목이 여러 줄로 바뀌는 업무 자료입니다. 이 행은 resize 후 실제 높이를 다시 측정해야 합니다." : ""}`,
    amount: index,
  }));
}
