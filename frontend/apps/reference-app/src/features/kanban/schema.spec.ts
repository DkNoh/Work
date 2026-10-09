import { describe, expect, it } from "vitest";
import { emptyTaskDraft, taskSchema } from "./schema";
describe("칸반 저장 전 입력", () => {
  it("설명 줄바꿈·쉼표 있는 단일 태그·초기 연도 달력 날짜를 보존한다", () => {
    for (const dueDate of ["0000-02-29", "0099-12-31"]) {
      const input = {
        ...emptyTaskDraft(),
        title: " 작업 ",
        description: " 줄바꿈\n 유지 ",
        tags: ["한, 태그"],
        dueDate,
      };
      const result = taskSchema.parse(input);
      expect(result).toMatchObject({
        title: input.title,
        description: input.description,
        tags: input.tags,
        dueDate,
        assigneeId: null,
      });
    }
  });
  it("가짜 윤일/태그 개수/소수 담당자 ID를 거절한다", () => {
    for (const override of [
      { dueDate: "1900-02-29" },
      { assigneeId: "1.5" },
      { tags: Array.from({ length: 11 }, (_, i) => String(i)) },
    ])
      expect(
        taskSchema.safeParse({ ...emptyTaskDraft(), title: "작업", ...override }).success,
      ).toBe(false);
  });
});
