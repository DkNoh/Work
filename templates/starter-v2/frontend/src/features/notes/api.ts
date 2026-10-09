/**
 * 생성 앱 소유 Notes HTTP 계약이다. OpenAPI components의 DTO를 선택해 TypeScript 타입으로 사용하고 Zod로 실제 응답 모양도 검증한다.
 * TypeScript 타입은 실행 시 사라진다. request<unknown>으로 받은 JSON을 safeParse한 뒤에만 Note/NotePage/NoteCommand로 돌려준다.
 * query key는 목록 검색어/단건 ID/전체 통계를 분리한다. 저장 응답에는 item과 같은 트랜잭션의 stats를 함께 받아 즉시 표시할 수 있다.
 */
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
/**
 * Java 제네릭처럼 schema의 출력 타입 T를 결과에 연결한다. 응답 검증 실패는 공통 ApiError로 바꾸어 화면이 일관되게 처리한다.
 */
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError("응답 형식을 확인할 수 없습니다.", 502, "INVALID_RESPONSE");
  return result.data;
}
/**
 * 생성 앱 runtime을 주입받아 단일 client로 요청한다. 수정 DTO의 revision으로 서버의 낙관적 동시성 검사를 요청한다.
 */
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
