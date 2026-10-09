import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readWorkbook, writeWorkbook, type ScWorkbookColumn } from "./index";

const columns = [
  { key: "title", label: "제목", type: "string" },
  { key: "amount", label: "수량", type: "number" },
  { key: "active", label: "활성", type: "boolean" },
  { key: "date", label: "일시", type: "date" },
] as const satisfies readonly ScWorkbookColumn[];

describe("XLSX 중립 adapter", () => {
  it("실제 XLSX의 한글/null/날짜/수식처럼 보이는 문자열을 재읽고 원본을 보존한다", async () => {
    const rows = Object.freeze([
      Object.freeze({
        title: "한국어 자료",
        amount: 5.25,
        active: true,
        date: new Date("2026-01-02T03:04:05Z"),
      }),
      Object.freeze({
        title: '=HYPERLINK("https://example.test")',
        amount: null,
        active: false,
        date: null,
      }),
    ]);
    const bytes = await writeWorkbook({ columns, rows, sheetName: "검증" });
    const read = await readWorkbook(bytes, { columns });
    expect(read.errors).toEqual([]);
    expect(read.sheetName).toBe("검증");
    expect(read.rows).toEqual(rows);
    expect(read.sourceRowNumbers).toEqual([2, 3]);
    expect(rows[0].date.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("유효한 행만 반환하고 수식·잘못된 형식의 XLSX 행 번호를 보고한다", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("자료");
    sheet.addRow(columns.map((column) => column.label));
    sheet.addRow(["유효", 3, true, null]);
    sheet.addRow([{ formula: "1+1", result: 2 }, 1, true, null]);
    sheet.addRow(["오류", "숫자가 아님", true, null]);
    sheet.addRow([null, null, null, null]);
    sheet.addRow(["마지막 유효", 9, false, null]);
    const read = await readWorkbook(await workbook.xlsx.writeBuffer(), { columns });
    expect(read.rows).toEqual([
      { title: "유효", amount: 3, active: true, date: null },
      { title: "마지막 유효", amount: 9, active: false, date: null },
    ]);
    expect(read.sourceRowNumbers).toEqual([2, 6]);
    expect(read.errors).toMatchObject([
      { row: 3, column: "title", code: "FORMULA_NOT_ALLOWED" },
      { row: 4, column: "amount", code: "INVALID_VALUE" },
    ]);
  });

  it("파일·행·열·헤더 제한과 손상 파일을 구분한다", async () => {
    const bytes = await writeWorkbook({
      columns,
      rows: [{ title: "첫 자료" }, { title: "둘째 자료" }],
    });
    expect(
      (await readWorkbook(bytes, { columns, limits: { maxFileBytes: 1 } })).errors[0]?.code,
    ).toBe("FILE_LIMIT");
    expect((await readWorkbook(bytes, { columns, limits: { maxRows: 1 } })).errors[0]?.code).toBe(
      "SHEET_LIMIT",
    );
    expect(
      (await readWorkbook(bytes, { columns: [{ key: "title", label: "다른 열", type: "string" }] }))
        .errors[0]?.code,
    ).toBe("HEADER_MISMATCH");
    expect((await readWorkbook(new Uint8Array([1, 2, 3]), { columns })).errors[0]?.code).toBe(
      "INVALID_FILE",
    );
    await expect(writeWorkbook({ columns, rows: [], limits: { maxColumns: 1 } })).rejects.toThrow(
      RangeError,
    );
    await expect(
      writeWorkbook({
        columns,
        rows: [{ title: "첫 자료" }, { title: "둘째 자료" }],
        limits: { maxRows: 1 },
      }),
    ).rejects.toThrow(RangeError);
  });
});
