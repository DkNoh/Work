/**
 * 운영 capability·outbox 메시지·예약/실행 이력·브라우저 오류의 HTTP 경계다. 서버 DTO는 이 앱의 OpenAPI 생성 타입을 선택해 사용한다.
 * operationKeys는 Vue Query 캐시 식별자의 공통 prefix다. 메시지 재시도/예약 저장 뒤 관련 prefix만 무효화하여 재조회한다.
 * 조회 함수의 AbortSignal은 공통 client까지 전달하고 모든 변경 요청은 같은 client의 쿠키 세션/CSRF/timeout/오류 변환을 거친다.
 * 스케줄 revision은 낙관적 동시성 값이다. 재시도/실행 권한과 상태 전이의 최종 결정은 서버 서비스가 맡는다.
 */
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";
import type { FrameworkRuntime } from "@sc/runtime";

export type FrameworkCapabilities = components["schemas"]["FrameworkCapabilities"];
export type MessageItem = components["schemas"]["OperationMessageItem"];
export type MessagePage = components["schemas"]["OperationMessagePage"];
export type Schedule = components["schemas"]["OperationalScheduleResponse"];
export type ScheduleInput = components["schemas"]["OperationalScheduleInput"];
export type ScheduleUpdate = components["schemas"]["OperationalScheduleUpdateInput"];
export type SchedulePage = components["schemas"]["OperationalSchedulePage"];
export type RegisteredJobs = components["schemas"]["OperationalRegisteredJobsResponse"];
export type RunPage = components["schemas"]["OperationalRunPage"];
export type BrowserGroupPage = components["schemas"]["BrowserErrorGroupPage"];
export type BrowserOccurrencePage = components["schemas"]["BrowserErrorOccurrencePage"];

export const operationKeys = {
  capabilities: ["framework", "capabilities"] as const,
  messages: ["operations", "messages"] as const,
  jobs: ["operations", "jobs"] as const,
  schedules: ["operations", "schedules"] as const,
  scheduleDetails: ["operations", "schedule-detail"] as const,
  runs: ["operations", "runs"] as const,
  browserGroups: ["operations", "browser-groups"] as const,
  browserOccurrences: ["operations", "browser-occurrences"] as const,
};

export function createOperationsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    capabilities: (signal?: AbortSignal) =>
      request<FrameworkCapabilities>("/framework/capabilities", "GET", undefined, { signal }),
    messages: (parameters: string, signal?: AbortSignal) =>
      request<MessagePage>(`/operations/messages?${parameters}`, "GET", undefined, { signal }),
    retryMessage: (id: string) =>
      request<MessageItem>(`/operations/messages/${encodeURIComponent(id)}/retry`, "POST", {}),
    demoMessage: () => request<MessageItem>("/operations/messages/demo", "POST", {}),
    registeredJobs: (signal?: AbortSignal) =>
      request<RegisteredJobs>("/operations/jobs/registered", "GET", undefined, { signal }),
    schedules: (parameters: string, signal?: AbortSignal) =>
      request<SchedulePage>(`/operations/jobs/schedules?${parameters}`, "GET", undefined, {
        signal,
      }),
    schedule: (id: number, signal?: AbortSignal) =>
      request<Schedule>(`/operations/jobs/schedules/${id}`, "GET", undefined, { signal }),
    createSchedule: (input: ScheduleInput) =>
      request<Schedule>("/operations/jobs/schedules", "POST", input),
    saveSchedule: (id: number, input: ScheduleUpdate) =>
      request<Schedule>(`/operations/jobs/schedules/${id}`, "PUT", input),
    changeSchedule: (id: number, action: "pause" | "resume", revision: number) =>
      request<Schedule>(`/operations/jobs/schedules/${id}/${action}`, "POST", { revision }),
    runs: (parameters: string, signal?: AbortSignal) =>
      request<RunPage>(`/operations/jobs/runs?${parameters}`, "GET", undefined, { signal }),
    browserGroups: (parameters: string, signal?: AbortSignal) =>
      request<BrowserGroupPage>(
        `/operations/browser-errors/groups?${parameters}`,
        "GET",
        undefined,
        { signal },
      ),
    browserOccurrences: (id: number, parameters: string, signal?: AbortSignal) =>
      request<BrowserOccurrencePage>(
        `/operations/browser-errors/groups/${id}/occurrences?${parameters}`,
        "GET",
        undefined,
        { signal },
      ),
  };
}
