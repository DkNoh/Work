import ExcelJS from "exceljs";

export type ScExcelCell = string | number | boolean | Date | null;
export interface ScWorkbookColumn<TKey extends string = string> {
  key: TKey;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}
export interface ScWorkbookLimits {
  maxRows?: number;
  maxColumns?: number;
  maxFileBytes?: number;
}
export interface ScWorkbookError {
  row: number;
  column?: string;
  code: string;
  message: string;
}
export interface ScWorkbookWriteOptions<TKey extends string = string> {
  columns: readonly ScWorkbookColumn<TKey>[];
  rows: readonly Partial<Record<TKey, ScExcelCell>>[];
  sheetName?: string;
  limits?: ScWorkbookLimits;
}
export interface ScWorkbookReadOptions<TKey extends string = string> {
  columns: readonly ScWorkbookColumn<TKey>[];
  sheetName?: string;
  limits?: ScWorkbookLimits;
}
export interface ScWorkbookReadResult<TKey extends string = string> {
  rows: Record<TKey, ScExcelCell>[];
  /** rows의 같은 index에 대응하는 원본 XLSX 1-based 물리 행 번호. */
  sourceRowNumbers: number[];
  errors: ScWorkbookError[];
  sheetName: string;
}
const defaults = { maxRows: 10_000, maxColumns: 100, maxFileBytes: 10 * 1024 * 1024 };
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

function limitsFor(limits: ScWorkbookLimits = {}) {
  const value = { ...defaults, ...limits };
  if (Object.values(value).some((limit) => !Number.isSafeInteger(limit) || limit < 1))
    throw new RangeError("Excel 제한은 1 이상의 정수여야 합니다.");
  return value;
}
function validateColumns(columns: readonly ScWorkbookColumn[], maxColumns: number) {
  if (!columns.length || columns.length > maxColumns)
    throw new RangeError("Excel 열 개수가 제한을 벗어났습니다.");
  const keys = new Set<string>();
  const labels = new Set<string>();
  for (const column of columns) {
    if (
      !column.key ||
      forbiddenKeys.has(column.key) ||
      !column.label.trim() ||
      keys.has(column.key) ||
      labels.has(column.label) ||
      !["string", "number", "boolean", "date"].includes(column.type)
    )
      throw new TypeError("Excel 열은 고유한 key/label과 지원하는 type을 가져야 합니다.");
    keys.add(column.key);
    labels.add(column.label);
  }
}
function isCellType(value: unknown, type: ScWorkbookColumn["type"]): value is ScExcelCell {
  if (value == null) return true;
  if (type === "date") return value instanceof Date && Number.isFinite(value.getTime());
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
function asArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** 파일 선택·다운로드·업무 반영 없이 앱이 제공한 행을 XLSX 문서로 변환한다. */
export async function writeWorkbook<TKey extends string>(
  options: ScWorkbookWriteOptions<TKey>,
): Promise<ArrayBuffer> {
  const limits = limitsFor(options.limits);
  validateColumns(options.columns, limits.maxColumns);
  if (options.rows.length > limits.maxRows)
    throw new RangeError("Excel 행 개수가 제한을 넘었습니다.");
  const sheetName = options.sheetName ?? "자료";
  if (!sheetName.trim() || sheetName.length > 31 || /[\\/*?:[\]]/.test(sheetName))
    throw new TypeError("지원하지 않는 Excel 시트 이름입니다.");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(options.columns.map((column) => column.label));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of options.rows) {
    sheet.addRow(
      options.columns.map((column) => {
        const value = row[column.key] ?? null;
        if (!isCellType(value, column.type))
          throw new TypeError(`${column.label} 값의 형식이 올바르지 않습니다.`);
        // 문자열은 formula 객체로 바꾸지 않는다. =, +, -, @로 시작해도 문자열 셀이다.
        return value instanceof Date ? new Date(value.getTime()) : value;
      }),
    );
  }
  options.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.min(40, Math.max(12, column.label.length + 4));
    if (column.type === "date") sheet.getColumn(index + 1).numFmt = "yyyy-mm-dd hh:mm:ss";
  });
  const bytes = await workbook.xlsx.writeBuffer();
  if (bytes.byteLength > limits.maxFileBytes)
    throw new RangeError("Excel 파일 크기가 제한을 넘었습니다.");
  return asArrayBuffer(bytes as unknown as Uint8Array);
}

/** XLSX 행 번호를 유지해 구조/셀 오류를 반환한다. 오류가 있는 행은 결과 rows에 반영하지 않는다. */
export async function readWorkbook<TKey extends string>(
  bytes: ArrayBuffer | Uint8Array,
  options: ScWorkbookReadOptions<TKey>,
): Promise<ScWorkbookReadResult<TKey>> {
  const limits = limitsFor(options.limits);
  validateColumns(options.columns, limits.maxColumns);
  const result: ScWorkbookReadResult<TKey> = {
    rows: [],
    sourceRowNumbers: [],
    errors: [],
    sheetName: "",
  };
  const fail = (code: string, message: string, row = 0, column?: string) =>
    result.errors.push({ row, column, code, message });
  if (bytes.byteLength > limits.maxFileBytes) {
    fail("FILE_LIMIT", "Excel 파일 크기가 제한을 넘었습니다.");
    return result;
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(asArrayBuffer(bytes));
  } catch {
    fail("INVALID_FILE", "읽을 수 있는 XLSX 파일이 아닙니다.");
    return result;
  }
  const sheet = options.sheetName
    ? workbook.getWorksheet(options.sheetName)
    : workbook.worksheets[0];
  if (!sheet) {
    fail("MISSING_SHEET", "읽을 시트가 없습니다.");
    return result;
  }
  result.sheetName = sheet.name;
  if (sheet.columnCount > limits.maxColumns || sheet.rowCount - 1 > limits.maxRows) {
    fail("SHEET_LIMIT", "Excel 행 또는 열 개수가 제한을 넘었습니다.");
    return result;
  }
  if (
    sheet.columnCount !== options.columns.length ||
    options.columns.some(
      (column, index) => sheet.getRow(1).getCell(index + 1).value !== column.label,
    )
  ) {
    fail("HEADER_MISMATCH", "Excel 열 이름과 순서가 정의한 열과 다릅니다.", 1);
    return result;
  }
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const cells = options.columns.map((_, index) => sheet.getRow(rowNumber).getCell(index + 1));
    if (cells.every((cell) => cell.value == null)) continue;
    const record = {} as Record<TKey, ScExcelCell>;
    let valid = true;
    options.columns.forEach((column, index) => {
      const value = cells[index]!.value;
      if (typeof value === "object" && value !== null && !(value instanceof Date)) {
        fail(
          "formula" in value || "sharedFormula" in value
            ? "FORMULA_NOT_ALLOWED"
            : "UNSUPPORTED_CELL",
          "수식·링크·서식 객체 셀은 가져올 수 없습니다.",
          rowNumber,
          column.key,
        );
        valid = false;
      } else if (!isCellType(value, column.type)) {
        fail(
          "INVALID_VALUE",
          `${column.label} 값의 형식이 올바르지 않습니다.`,
          rowNumber,
          column.key,
        );
        valid = false;
      } else
        record[column.key] = value instanceof Date ? new Date(value.getTime()) : (value ?? null);
    });
    if (valid) {
      result.rows.push(record);
      result.sourceRowNumbers.push(rowNumber);
    }
  }
  return result;
}
