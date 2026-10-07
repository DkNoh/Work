import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScListDetailLayout } from "@sc/ui";
import ScListDetailStory from "./fixtures/ScListDetailStory.vue";
const meta = {
  title: "화면 패턴/ScListDetailLayout",
  component: ScListDetailLayout,
  args: { detailVisible: false },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScListDetailStory },
      setup: () => ({
        args,
        selectDetail: (detailVisible: boolean) => updateArgs({ detailVisible }),
      }),
      template: '<ScListDetailStory v-bind="args" @update:detail-visible="selectDetail" />',
    };
  },
} satisfies Meta<typeof ScListDetailLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const MobileDraft: Story = {
  globals: { viewport: { value: "mobile390", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "예제 선택" }));
    const input = await canvas.findByRole("textbox", { name: "작성 중인 상세" });
    await userEvent.type(input, "이동해도 남는 입력");
    await userEvent.click(canvas.getByRole("button", { name: "목록으로" }));
    await expect(input).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "예제 선택" }));
    await expect(input).toHaveValue("이동해도 남는 입력");
  },
};
