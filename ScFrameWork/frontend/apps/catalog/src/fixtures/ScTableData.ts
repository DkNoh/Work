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
