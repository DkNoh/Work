import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";
import { ScSectionCard } from "@sc/ui";
import ScSectionCardStory from "./fixtures/ScSectionCardStory.vue";

const meta = {
  title: "화면 패턴/ScSectionCard",
  component: ScSectionCard,
  args: {
    title: "조회 결과",
    description: "폼과 표는 소비 화면의 slot에서 조립합니다.",
    density: "comfortable",
    surface: "bordered",
  },
  argTypes: {
    density: { control: "select", options: ["comfortable", "compact"] },
    surface: { control: "select", options: ["bordered", "plain"] },
  },
  render: (args) => ({
    components: { ScSectionCardStory },
    setup: () => ({ args }),
    template: '<ScSectionCardStory :card="args" />',
  }),
  parameters: {
    docs: {
      description: {
        component:
          "제목·actions·본문 slot을 조립한다. density로 기본/대시보드 밀도를, surface로 테두리 유무를 선택한다. 제목·패딩·테두리의 내부 CSS를 화면에서 덮어쓰지 않는다.",
      },
    },
  },
} satisfies Meta<typeof ScSectionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "조회 결과" })).toHaveTextContent("슬롯 본문");
  },
};
export const Compact: Story = {
  args: { density: "compact" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "조회 결과" });
    await expect(card).toHaveAttribute("data-density", "compact");
    await expect(within(card).getByRole("button", { name: "상세 행동" })).toBeVisible();
  },
};
export const Plain: Story = {
  args: { surface: "plain", density: "compact" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "조회 결과" });
    await expect(card).toHaveAttribute("data-surface", "plain");
    await expect(getComputedStyle(card).borderTopWidth).toBe("0px");
  },
};
