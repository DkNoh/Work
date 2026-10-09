/**
 * 운영 화면 URL의 문자열/배열/null을 검증한 페이지·선택 ID로 바꾸는 순수 함수다. TypeScript 타입만으로 주소창 입력을 검증할 수는 없다.
 * operationPage의 null은 잘못된 페이지다. operationSelection은 null(선택 없음)과 undefined(잘못된 ID)를 구분한다.
 * 이 구분을 페이지의 valid/enabled에 연결하여 잘못된 URL이 첫 페이지 조회나 신규 폼으로 조용히 바뀌지 않게 한다.
 */
import type { LocationQuery } from "vue-router";

export function operationPage(query: LocationQuery, field = "page") {
  const value = query[field] ?? "0";
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && Number(value) <= 1_000_000
    ? Number(value)
    : null;
}
export function operationSelection(query: LocationQuery, field: string) {
  const value = query[field];
  if (value === undefined) return null;
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? Number(value)
    : undefined;
}
