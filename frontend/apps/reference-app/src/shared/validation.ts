// Zod 런타임 검증의 issues를 VeeValidate setErrors가 받는 필드별 메시지로 변환한다.
// readonly 배열은 이 함수가 입력을 수정하지 않는 정적 계약이고, Record<string, string>은 Java Map<String, String>과 비슷한 키/값 객체 타입이다.
import type { z } from "zod";

export function formIssueMessages(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    // 중첩 경로를 a.b처럼 합치고 같은 필드의 첫 메시지만 보존한다. 빈 경로의 전역 오류는 이 필드 맵에 넣지 않는다.
    const field = issue.path.join(".");
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
