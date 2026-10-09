/**
 * 생성 앱 v2의 운영 API 경계다. 운영 DTO는 공개 @sc/runtime ApiComponents를 소비하고 Notes 전용 generated 타입과 분리한다.
 * 모든 HTTP는 이 앱의 runtime.client 한 개를 경유한다. Query/세션 수명과 서버 기능 활성 여부를 기준으로 기능을 연결한다.
 * 공통 패키지 또는 다른 업무 앱의 내부 src를 import하지 않는다. API 타입은 컴파일 계약이고 실제 권한/유효성은 서버가 검사한다.
 */
import type { ApiComponents } from "@sc/runtime";
import type { FrameworkRuntime } from "@sc/runtime";

export type FrameworkCapabilities = ApiComponents["schemas"]["FrameworkCapabilities"];
export type MessageItem = ApiComponents["schemas"]["OperationMessageItem"];
export type MessagePage = ApiComponents["schemas"]["OperationMessagePage"];
export type Schedule = ApiComponents["schemas"]["OperationalScheduleResponse"];
export type ScheduleInput = ApiComponents["schemas"]["OperationalScheduleInput"];
export type ScheduleUpdate = ApiComponents["schemas"]["OperationalScheduleUpdateInput"];
export type SchedulePage = ApiComponents["schemas"]["OperationalSchedulePage"];
export type RegisteredJobs = ApiComponents["schemas"]["OperationalRegisteredJobsResponse"];
export type RunPage = ApiComponents["schemas"]["OperationalRunPage"];
export type BrowserGroupPage = ApiComponents["schemas"]["BrowserErrorGroupPage"];
export type BrowserOccurrencePage = ApiComponents["schemas"]["BrowserErrorOccurrencePage"];

/**
 * 캐시 prefix를 기능별로 구분하여 예약 저장이 관련 목록/단건/실행 이력만 갱신하도록 한다.
 */
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

export function createOperationsApi(runtime: FrameworkRuntime) {
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
