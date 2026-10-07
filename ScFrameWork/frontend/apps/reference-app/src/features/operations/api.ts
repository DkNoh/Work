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
