/**
 * 공통 로그인 정보에 Reference 업무 사용자(id/displayName/단일 role)를 추가하는 타입 경계다.
 * interface extends는 구조를 확장하는 TypeScript 선언이며 Java 객체 생성이나 런타임 검사 기능을 만들지 않는다.
 * 서버 JSON은 신뢰 전에는 unknown이다. decode 함수가 실제 값의 형태를 확인한 뒤에만 업무 화면으로 전달한다.
 */
import { useFrameworkRuntime, type Identity } from "@sc/runtime";

export interface ReferenceIdentity extends Identity {
  id: number;
  displayName: string;
  role: "REQUESTER" | "REVIEWER" | "ADMIN";
}

/**
 * value is ...는 사용자 정의 타입 가드다. true를 반환한 분기에서는 TypeScript가 value를 허용 역할 union으로 좁힌다.
 */
function isReferenceRole(value: unknown): value is ReferenceIdentity["role"] {
  return value === "REQUESTER" || value === "REVIEWER" || value === "ADMIN";
}

/**
 * Record<string, unknown>은 문자열 키의 맵 타입이다. as 변환만으로 검증되는 것이 아니므로 각 필드 조건을 아래에서 직접 확인한다.
 * 공통 runtime의 roles 배열은 검증한 단일 role에서 파생한다. 서버 응답에 없는 임의 권한을 추가하지 않는다.
 */
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

/**
 * 컴포넌트 setup에서 호출하는 composable이다. 이 앱의 사용자 타입이 지정된 공통 runtime을 의존성 주입으로 가져온다.
 */
export function useReferenceRuntime() {
  return useFrameworkRuntime<ReferenceIdentity>();
}
