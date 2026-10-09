// 칸반 접근권한·보드·작업·멤버와 일괄 가져오기의 HTTP 계약이다. UI의 이동 이벤트를 바로 DB 변경으로 간주하지 않는다.
// FrameworkRuntime은 앱 시작 시 생성한 공통 통신 객체다. cookie 세션·CSRF·오류 변환은 그 client가 맡는다.
import type { FrameworkRuntime } from "@sc/runtime";
import type { ReferenceIdentity } from "../../auth/identity";
import type { components } from "../../generated/api";
// DTO 타입을 OpenAPI의 schemas에서 꺼낸다. Java DTO와 비슷한 개발 시 계약이지만 TS 타입은 빌드 후 사라진다.
// request<T>의 T는 Promise 결과의 정적 타입이며, 이것만으로 서버 JSON의 런타임 검증이 수행되지는 않는다.
export type Task = components["schemas"]["TaskResponse"];
export type TaskInput = components["schemas"]["TaskInput"];
export type TaskCreateInput = components["schemas"]["TaskCreateInput"];
export type TaskImportInput = components["schemas"]["TaskImportInput"];
export type TaskImportResult = components["schemas"]["TaskImportResult"];
export type Board = components["schemas"]["BoardResponse"];
export type KanbanUser = components["schemas"]["KanbanUserResponse"];
export type KanbanMember = components["schemas"]["KanbanMemberResponse"];
export type TaskMoveInput = components["schemas"]["TaskMoveInput"];
export interface KanbanFilters {
  boardId: number;
  q: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  view: "ALL" | "CREATED" | "ASSIGNED";
}
// 팩토리에 runtime을 주입하고 메서드 묶음을 돌려준다. Java의 생성자 주입과 유사하지만 Spring bean은 아니다.
// signal?: AbortSignal의 ?는 생략 가능 인수다. Query의 취소 신호를 GET에 전달해 불필요한 이전 조회를 중단한다.
export function createKanbanApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    access: (signal?: AbortSignal) =>
      request<components["schemas"]["KanbanAccessResponse"]>("/kanban/access", "GET", undefined, {
        signal,
      }),
    boards: (signal?: AbortSignal) =>
      request<Board[]>("/kanban/boards", "GET", undefined, { signal }),
    users: (signal?: AbortSignal) =>
      request<KanbanUser[]>("/kanban/users", "GET", undefined, { signal }),
    members: (signal?: AbortSignal) =>
      request<KanbanMember[]>("/kanban/members", "GET", undefined, { signal }),
    setMember: (id: number, allowed: boolean) =>
      request<KanbanMember>(`/kanban/members/${id}`, "PUT", { allowed }),
    createBoard: (title: string) => request<Board>("/kanban/boards", "POST", { title }),
    renameBoard: (id: number, title: string, revision: number) =>
      request<Board>(`/kanban/boards/${id}`, "PUT", { title, revision }),
    // 조회 필터는 Router에서 해석한 값이다. q 등 빈 선택은 요청에서 생략하고, boardId/view는 항상 보낸다.
    tasks: (filters: KanbanFilters, signal?: AbortSignal) => {
      const query = new URLSearchParams({ boardId: String(filters.boardId), view: filters.view });
      if (filters.q) query.set("q", filters.q);
      if (filters.status) query.set("status", filters.status);
      if (filters.priority) query.set("priority", filters.priority);
      if (filters.assigneeId !== null) query.set("assigneeId", String(filters.assigneeId));
      return request<Task[]>(`/kanban/tasks?${query}`, "GET", undefined, { signal });
    },
    detail: (id: number, signal?: AbortSignal) =>
      request<Task>(`/kanban/tasks/${id}`, "GET", undefined, { signal }),
    create: (input: TaskInput) => request<Task>("/kanban/tasks", "POST", input),
    save: (id: number, input: TaskInput) => request<Task>(`/kanban/tasks/${id}`, "PUT", input),
    remove: (id: number, revision: number) =>
      request<void>(`/kanban/tasks/${id}?revision=${revision}`, "DELETE"),
    // 드래그 결과는 status·beforeId·revision으로 전송한다. 실제 저장 순서는 서버가 결정하며 성공 후 Query를 다시 조회한다.
    move: (id: number, input: TaskMoveInput) =>
      request<Task>(`/kanban/tasks/${id}/move`, "POST", input),
    // 브라우저에서 검증한 미리보기 행을 하나의 가져오기 요청으로 보낸다. 원자적 저장/권한 검사는 서버의 계약이다.
    importTasks: (input: TaskImportInput) =>
      request<TaskImportResult>("/kanban/tasks/import", "POST", input),
  };
}
