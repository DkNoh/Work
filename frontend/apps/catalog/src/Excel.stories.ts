import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ScExcelStory from "./fixtures/ScExcelStory.vue";
const meta = { title: "확장 모듈/Excel", component: ScExcelStory } satisfies Meta<
  typeof ScExcelStory
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkbookRoundTrip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "XLSX 생성과 재읽기" }));
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "Excel 변환 결과" })).toHaveTextContent(
        "2행 재읽기 성공",
      ),
    );
    await expect(canvas.getByRole("table")).toHaveTextContent("한국어 XLSX 자료");
    await userEvent.click(canvas.getByRole("button", { name: "오류 파일 검사" }));
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "Excel 변환 결과" })).toHaveTextContent(
        "INVALID_FILE",
      ),
    );
    await expect(canvas.getByRole("table")).toHaveTextContent("한국어 XLSX 자료");
  },
};
