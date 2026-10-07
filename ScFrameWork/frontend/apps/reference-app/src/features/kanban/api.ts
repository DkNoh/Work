import type { FrameworkRuntime } from "@sc/runtime";
import type { ReferenceIdentity } from "../../auth/identity";
import type { components } from "../../generated/api";
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
    move: (id: number, input: TaskMoveInput) =>
      request<Task>(`/kanban/tasks/${id}/move`, "POST", input),
    importTasks: (input: TaskImportInput) =>
      request<TaskImportResult>("/kanban/tasks/import", "POST", input),
  };
}
