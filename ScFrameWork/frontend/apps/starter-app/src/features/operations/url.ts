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
