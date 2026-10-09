import { z } from "zod";
import { ApiError, type FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
export type Note = components["schemas"]["StarterNoteResponse"];
export type NotePage = components["schemas"]["StarterNotePage"];
export type NoteStats = components["schemas"]["StarterNoteStats"];
export type NoteCommand = components["schemas"]["StarterNoteCommand"];
export type NoteCreateInput = components["schemas"]["StarterNoteCreateInput"];
export type NoteUpdateInput = components["schemas"]["StarterNoteUpdateInput"];
const noteSchema: z.ZodType<Note> = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime({ offset: true }),
});
const statsSchema: z.ZodType<NoteStats> = z.object({
  total: z.number().int().nonnegative(),
  highestRevision: z.number().int().nonnegative(),
});
const pageSchema: z.ZodType<NotePage> = z.object({
  items: z.array(noteSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
});
const commandSchema: z.ZodType<NoteCommand> = z.object({ item: noteSchema, stats: statsSchema });
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError("응답 형식을 확인할 수 없습니다.", 502, "INVALID_RESPONSE");
  return result.data;
}
export function createNotesApi(runtime: FrameworkRuntime) {
  return {
    async list(q: string, signal?: AbortSignal): Promise<NotePage> {
      return decode(
        pageSchema,
        await runtime.client.request<unknown>(
          `/notes?q=${encodeURIComponent(q)}&page=0&size=20`,
          "GET",
          undefined,
          { signal },
        ),
      );
    },
    async detail(id: number, signal?: AbortSignal): Promise<Note> {
      return decode(
        noteSchema,
        await runtime.client.request<unknown>(`/notes/${id}`, "GET", undefined, { signal }),
      );
    },
    async stats(signal?: AbortSignal): Promise<NoteStats> {
      return decode(
        statsSchema,
        await runtime.client.request<unknown>("/notes/stats", "GET", undefined, { signal }),
      );
    },
    async create(body: NoteCreateInput): Promise<NoteCommand> {
      return decode(commandSchema, await runtime.client.request<unknown>("/notes", "POST", body));
    },
    async update(id: number, body: NoteUpdateInput): Promise<NoteCommand> {
      return decode(
        commandSchema,
        await runtime.client.request<unknown>(`/notes/${id}`, "PUT", body),
      );
    },
  };
}
export const noteKeys = {
  all: ["starter-notes"] as const,
  list: (q: string) => ["starter-notes", "list", q] as const,
  detail: (id: number | null) => ["starter-notes", "detail", id] as const,
  stats: ["starter-notes", "stats"] as const,
};
