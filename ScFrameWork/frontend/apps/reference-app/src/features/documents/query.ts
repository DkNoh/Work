export const documentKeys = {
  all: ["documents"] as const,
  lists: ["documents", "list"] as const,
  list: (q: string) => ["documents", "list", q] as const,
  detail: (id: number | null) => ["documents", "detail", id] as const,
};
