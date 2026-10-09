/**
 * 앱이 정의한 열/행과 XLSX 바이트를 서로 변환하는 라이브러리다.
 * 파일 선택·다운로드 버튼·서버 저장은 소비 앱이 맡는다. 여기에는 Vue 상태나 업무 권한이 없다.
 * ExcelJS 객체를 공개 계약으로 노출하지 않아 앱의 업무 DTO와 파일 라이브러리의 의존성을 분리한다.
 */
import ExcelJS from "exceljs";

export type ScExcelCell = string | number | boolean | Date | null;
// TKey는 Java 제네릭처럼 여러 타입에 재사용하는 자리다. "name" | "amount"를 넘기면
// column.key와 각 행의 속성 이름이 같은 집합으로 검사된다. 기본 string은 임의 문자열을 허용한다.
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
  // Record는 키별 값 사전, Partial은 키 생략을 허용한다. 생략된 셀은 출력 때 null이 된다.
  // readonly는 입력 배열을 수정하지 말라는 정적 계약이며 데이터 전체를 깊게 freeze하지는 않는다.
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
// 파일의 열 이름이 JS 객체 프로토타입 관련 속성을 덮어쓰지 못하도록 예약 키를 제외한다.
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

// 생략한 제한에는 기본값을 합치고 명시 값은 양의 안전한 정수인지 검사한다.
// 파일 오류와 달리 잘못된 호출 설정은 개발자가 수정해야 하므로 예외로 알린다.
function limitsFor(limits: ScWorkbookLimits = {}) {
  const value = { ...defaults, ...limits };
  if (Object.values(value).some((limit) => !Number.isSafeInteger(limit) || limit < 1))
    throw new RangeError("Excel 제한은 1 이상의 정수여야 합니다.");
  return value;
}
// 열 순서/키/표시명이 가져오기와 내보내기의 공통 스키마다. 중복 이름은 행 매핑을 모호하게 하므로 거절한다.
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
// value is ...는 boolean 검사와 함께 TS의 타입을 좁히는 타입 가드다.
// 숫자 문자열을 숫자로 바꾸는 암묵 변환은 하지 않으며 NaN/Invalid Date도 허용하지 않는다.
function isCellType(value: unknown, type: ScWorkbookColumn["type"]): value is ScExcelCell {
  if (value == null) return true;
  if (type === "date") return value instanceof Date && Number.isFinite(value.getTime());
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
// Uint8Array가 큰 buffer의 일부 view일 수 있으므로 보이는 바이트만 새 ArrayBuffer로 복사한다.
// 호출자의 원본 buffer를 ExcelJS나 반환값과 같은 변경 가능한 참조로 공유하지 않는다.
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
  // 첫 행은 제목이고 스크롤 시 고정한다. 데이터는 columns 순서로 매핑하므로
  // JS 객체의 속성 나열 순서에 XLSX 열 순서를 의존시키지 않는다.
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
  // async 결과는 Promise<ArrayBuffer>다. 쓰기 완료 후 실제 압축 파일 크기도 검사한다.
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
  // 파일/시트 전체 오류는 기본 row 0, 제목은 1, 데이터는 XLSX의 실제 1-based 행 번호를 쓴다.
  // 잘못된 파일을 읽는 경우도 화면이 한 방식으로 표시하도록 errors 배열로 반환한다.
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
  // 압축 파일 크기 제한과 파싱 후 행/열 제한은 서로 다른 검사다. 제목 행은 데이터 수에서 제외한다.
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
    // 이 객체는 해당 행이 모든 셀 검사를 통과한 경우에만 결과에 넣는다.
    // `as Record`는 아직 비어 있는 조립용 객체의 타입 단언이지 입력 파일의 유효성 보증이 아니다.
    const record = {} as Record<TKey, ScExcelCell>;
    let valid = true;
    options.columns.forEach((column, index) => {
      const value = cells[index]!.value;
      if (typeof value === "object" && value !== null && !(value instanceof Date)) {
        // ExcelJS의 수식/공유 수식/링크/rich text 객체를 업무 값으로 해석하거나 실행하지 않는다.
        // 날짜 객체만 별도 허용하고, 오류가 여러 셀에 있으면 같은 행의 오류들을 모두 모은다.
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
      // 빈 행/잘못된 행은 rows에서 빠지므로 병렬 배열에 원본 번호를 보존해야 오류 위치가 맞는다.
      result.rows.push(record);
      result.sourceRowNumbers.push(rowNumber);
    }
  }
  return result;
}
