import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import { uiTokens } from "@sc/ui";
import ScDesignTokensStory from "./fixtures/ScDesignTokensStory.vue";

const meta = {
  title: "디자인 기반/토큰",
  component: ScDesignTokensStory,
  parameters: {
    docs: {
      description: {
        component:
          "tokens.ts가 디자인 값의 단일 원본입니다. 값을 변경한 뒤 npm run tokens:generate --workspace @sc/ui로 CSS를 생성하며 typecheck에서 일치를 검사합니다. Vuetify 테마와 이 카탈로그는 같은 uiTokens를 직접 읽습니다. 의미색의 지정 텍스트 조합은 4.5:1, 밝은 표면의 focus는 3:1을 unit과 실제 브라우저에서 확인합니다. 새로운 업무의 색 조합은 별도로 검수합니다.",
      },
    },
  },
} satisfies Meta<typeof ScDesignTokensStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  args: { section: "colors" },
  name: "의미 색상",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(uiTokens.color.primary, { exact: true })[0]).toBeVisible();
    await expect(canvas.getByText("처리 오류", { exact: true })).toBeVisible();
  },
};
export const Spacing: Story = { args: { section: "spacing" }, name: "간격" };
export const Typography: Story = { args: { section: "typography" }, name: "한국어 타이포" };
export const Shape: Story = { args: { section: "shape" }, name: "반경과 그림자" };
export const Responsive: Story = {
  args: { section: "responsive" },
  name: "반응형·키보드",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "포커스 확인" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("선택 1회");
    await userEvent.tab();
    const input = canvas.getByRole("textbox", { name: "긴 한국어 업무 제목" });
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).outlineStyle).toBe("solid");
  },
};
