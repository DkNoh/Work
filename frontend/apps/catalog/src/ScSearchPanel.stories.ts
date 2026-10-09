import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import { ScSearchPanel } from "@sc/ui";
import ScSearchPanelStory from "./fixtures/ScSearchPanelStory.vue";
const meta = {
  title: "화면 패턴/ScSearchPanel",
  component: ScSearchPanel,
  args: { label: "목록 검색" },
  render: (args) => ({
    components: { ScSearchPanelStory },
    setup: () => ({ args }),
    template: '<ScSearchPanelStory v-bind="args" />',
  }),
} satisfies Meta<typeof ScSearchPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SearchAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "검색어" });
    await userEvent.type(input, "한국어 검색");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "확정 검색어" })).toHaveTextContent(
      "한국어 검색",
    );
    await userEvent.click(canvas.getByRole("button", { name: "초기화" }));
    await expect(input).toHaveValue("");
    await expect(canvas.getByRole("status")).toHaveTextContent("전체 조회");
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox", { name: "검색어" })).toBeDisabled();
  },
};
