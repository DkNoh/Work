import { z } from "zod";
import { isCalendarDate } from "@sc/date";
export const taskStatuses = ["TODO", "IN_PROGRESS", "DONE", "REJECTED"] as const;
export const taskPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
const nullableId = z
  .string()
  .refine(
    (value) => value === "" || (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))),
    "양의 사용자 ID가 필요합니다.",
  )
  .transform((value) => (value === "" ? null : Number(value)));
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력하세요.")
    .max(200)
    .refine((value) => value.trim().length > 0, "제목을 입력하세요."),
  description: z.string().max(10000),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  assigneeId: nullableId,
  dueDate: z
    .string()
    .refine((value) => value === "" || isCalendarDate(value), "실제 YYYY-MM-DD 날짜를 입력하세요.")
    .transform((value) => (value === "" ? null : value)),
  tags: z.array(z.string().min(1).max(30)).max(10),
});
export interface TaskDraft {
  title: string;
  description: string;
  status: string | null;
  priority: string | null;
  assigneeId: string | null;
  dueDate: string;
  tags: string[];
  tagInput: string;
}
export function emptyTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "",
    dueDate: "",
    tags: [],
    tagInput: "",
  };
}
