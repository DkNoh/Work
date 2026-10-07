import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScStatusBadge } from "@sc/ui";
import ScStatusBadgeStory from "./fixtures/ScStatusBadgeStory.vue";

const meta = {
  title: "공통 UI/ScStatusBadge",
  component: ScStatusBadge,
  args: { label: "처리 완료", tone: "success" },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "primary", "secondary", "success", "warning", "danger", "info"],
    },
  },
  render: (args) => ({
    components: { ScStatusBadgeStory },
    setup: () => ({ args }),
    template: '<ScStatusBadgeStory :badge="args" />',
  }),
  parameters: {
    docs: {
      description: {
        component:
          "상태를 label과 의미색 tone으로 표시한다. 색상만으로 상태를 전달하지 않으며 정적인 배지는 aria-live를 사용하지 않는다. 업무 상태→label/tone 매핑은 소비 앱이 소유한다.",
      },
    },
  },
} satisfies Meta<typeof ScStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText("처리 완료");
    await expect(badge).toHaveAttribute("data-tone", "success");
    await expect(badge).not.toHaveAttribute("aria-live");
  },
};
export const AllTones: Story = {
  render: (args) => ({
    components: { ScStatusBadgeStory },
    setup: () => ({ args }),
    template: '<ScStatusBadgeStory :badge="args" gallery />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of [
      "작성 중",
      "진행 중",
      "검토 중",
      "처리 완료",
      "확인 필요",
      "처리 실패",
      "안내",
    ]) {
      await expect(canvas.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};
