import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScEmptyState, ScActionButton } from "@sc/ui";
const meta = {
  title: "화면 패턴/ScEmptyState",
  component: ScEmptyState,
  args: { title: "검색 결과가 없습니다", message: "검색 조건을 바꿔 다시 조회해 주세요." },
  render: (args) => ({
    components: { ScEmptyState, ScActionButton },
    setup: () => {
      const retries = ref(0);
      return { args, retries, reportRetry: () => retries.value++ };
    },
    template:
      '<ScEmptyState v-bind="args"><template #actions><ScActionButton>새 자료</ScActionButton></template></ScEmptyState>',
  }),
} satisfies Meta<typeof ScEmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};
