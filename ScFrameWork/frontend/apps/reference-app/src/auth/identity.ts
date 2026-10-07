import { useFrameworkRuntime, type Identity } from "@sc/runtime";

export interface ReferenceIdentity extends Identity {
  id: number;
  displayName: string;
  role: "REQUESTER" | "REVIEWER" | "ADMIN";
}

function isReferenceRole(value: unknown): value is ReferenceIdentity["role"] {
  return value === "REQUESTER" || value === "REVIEWER" || value === "ADMIN";
}

export function decodeReferenceIdentity(payload: unknown): ReferenceIdentity {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid reference identity");
  const value = payload as Record<string, unknown>;
  if (
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.username !== "string" ||
    !value.username.trim() ||
    typeof value.displayName !== "string" ||
    !value.displayName.trim() ||
    !isReferenceRole(value.role)
  )
    throw new Error("Invalid reference identity");
  const role = value.role;
  // roles는 공통 runtime 내부 계약이다. 서버의 원본 User JSON에는 추가하지 않는다.
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    role,
    roles: [role],
  };
}

export function useReferenceRuntime() {
  return useFrameworkRuntime<ReferenceIdentity>();
}
