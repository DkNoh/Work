import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScLoadingState } from "@sc/ui";
const meta = {
  title: "화면 패턴/ScLoadingState",
  component: ScLoadingState,
  args: { label: "자료 불러오는 중…" },
  render: (args) => ({
    components: { ScLoadingState },
    setup: () => {
      const retries = ref(0);
      return { args, retries, reportRetry: () => retries.value++ };
    },
    template: '<ScLoadingState v-bind="args" />',
  }),
} satisfies Meta<typeof ScLoadingState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};
