export const noticeKeys = {
  all: ["notices"] as const,
  lists: ["notices", "list"] as const,
  list: (q: string) => ["notices", "list", q] as const,
  detail: (id: number | null) => ["notices", "detail", id] as const,
};
