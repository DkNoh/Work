import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import { ScErrorPanel } from "@sc/ui";
const meta = {
  title: "화면 패턴/ScErrorPanel",
  component: ScErrorPanel,
  args: { message: "서버에서 조회하지 못했습니다." },
  render: (args) => ({
    components: { ScErrorPanel },
    setup: () => {
      const retries = ref(0);
      return { args, retries, reportRetry: () => retries.value++ };
    },
    template:
      '<ScErrorPanel v-bind="args" @retry="reportRetry" /><p role="status">{{ retries }}회 재조회</p>',
  }),
} satisfies Meta<typeof ScErrorPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다시 조회" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("1회 재조회");
  },
};
