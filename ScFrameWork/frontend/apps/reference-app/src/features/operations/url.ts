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
