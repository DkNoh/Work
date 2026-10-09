// 칸반 입력 문자열을 API 값으로 변환한다. 빈 담당자는 null/숫자, 빈 기한은 null이며 기한은 실제 달력 날짜로 검사한다.
// Zod 스키마는 실행 시 존재하는 검증 코드다. TypeScript interface/type만 선언하면 브라우저 입력을 검증하지 못한다.
import { z } from "zod";
import { isCalendarDate } from "@sc/date";
// readonly 리터럴 튜플은 선택 옵션과 z.enum이 같은 상태 집합을 사용하게 한다. 서버 상태 전이 규칙과는 별도다.
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
// 폼은 아직 검증되지 않은 string|null과 입력 중 tagInput도 보유한다. API 전송에는 safeParse 결과만 사용한다.
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
// 새 입력의 초기 상태를 새 객체/배열로 만든다. 태그 배열을 기존 작업의 props와 함께 수정하지 않는다.
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
