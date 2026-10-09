import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScPageHeader, ScActionButton } from "@sc/ui";
const meta = {
  title: "화면 패턴/ScPageHeader",
  component: ScPageHeader,
  args: {
    title: "업무 조회",
    subtitle: "긴 한국어 설명도 공통 제목과 같은 토큰으로 표시합니다.",
    eyebrow: "레퍼런스 / 업무",
  },
  render: (args) => ({
    components: { ScPageHeader, ScActionButton },
    setup: () => {
      const retries = ref(0);
      return { args, retries, reportRetry: () => retries.value++ };
    },
    template:
      '<ScPageHeader v-bind="args"><template #actions><ScActionButton>새 자료</ScActionButton></template></ScPageHeader>',
  }),
} satisfies Meta<typeof ScPageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("업무 조회");
  },
};
