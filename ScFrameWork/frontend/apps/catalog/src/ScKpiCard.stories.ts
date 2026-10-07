import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScKpiCard } from "@sc/ui";
import ScKpiCardStory from "./fixtures/ScKpiCardStory.vue";

const meta = {
  title: "화면 패턴/ScKpiCard",
  component: ScKpiCard,
  args: {
    label: "처리한 요청",
    value: "1,248",
    trend: "전월보다 2.5% 증가",
    trendDirection: "up",
    note: "이번 달",
    tone: "green",
    density: "comfortable",
    iconPath: "M5 3h14v18H5V3m2 2v14h10V5H7m2 3h6v2H9V8m0 4h6v2H9v-2m0 4h4v1H9v-1",
  },
  argTypes: {
    tone: { control: "select", options: ["green", "violet", "pink", "amber"] },
    trendDirection: { control: "select", options: ["up", "down", "neutral"] },
    density: { control: "select", options: ["comfortable", "compact"] },
  },
  render: (args) => ({
    components: { ScKpiCardStory },
    setup: () => ({ args }),
    template: '<ScKpiCardStory :card="args" />',
  }),
} satisfies Meta<typeof ScKpiCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Green: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("region", { name: "처리한 요청" });
    await expect(card).toHaveTextContent("1,248");
    await expect(card).toHaveTextContent("전월보다 2.5% 증가");
    await expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  },
};
export const Violet: Story = { args: { tone: "violet", label: "검토 중", value: "42" } };
export const Pink: Story = {
  args: {
    tone: "pink",
    label: "보완이 필요한 요청",
    value: "18",
    trend: "전월보다 3.4% 감소",
    trendDirection: "down",
  },
};
export const Amber: Story = {
  args: {
    tone: "amber",
    label: "참여한 구성원",
    value: "352",
    trend: "지난달과 동일",
    trendDirection: "neutral",
  },
};
export const FourMetrics: Story = {
  render: (args) => ({
    components: { ScKpiCardStory },
    setup: () => ({ args }),
    template: '<ScKpiCardStory :card="args" gallery />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("region")).toHaveLength(4);
    await expect(canvas.getByRole("region", { name: "보완이 필요한 요청" })).toHaveTextContent(
      "3.4% 감소",
    );
  },
};
export const Compact: Story = {
  args: { density: "compact", value: "₩31.4M", label: "이번 달 매출" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "이번 달 매출" });
    await expect(card).toHaveAttribute("data-density", "compact");
    await expect(card).toHaveTextContent("₩31.4M");
    await expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  },
};
