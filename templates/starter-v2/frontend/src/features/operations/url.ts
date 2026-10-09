/**
 * 운영 URL의 페이지와 선택 ID를 검증하는 순수 함수다. query는 문자열뿐 아니라 배열/null도 가능하므로 typeof 검사부터 수행한다.
 * pageNumber의 null은 오류다. selectedId는 null(선택 없음)과 undefined(잘못된 선택)을 구분하며 화면 valid/enabled가 이 결과로 조회를 제어한다.
 */
import type { LocationQuery } from "vue-router";
export function pageNumber(query: LocationQuery, name = "page") {
  const value = query[name] ?? "0";
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && Number(value) <= 1_000_000
    ? Number(value)
    : null;
}
export function selectedId(query: LocationQuery, name: string) {
  const value = query[name];
  if (value === undefined) return null;
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? Number(value)
    : undefined;
}
