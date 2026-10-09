import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScTextArea } from "@sc/ui";
import ScTextAreaStory from "./fixtures/ScTextAreaStory.vue";

const meta = {
  title: "공통 UI/ScTextArea",
  component: ScTextArea,
  args: { modelValue: "", label: "업무 설명", rows: 4, density: "comfortable" },
  argTypes: { density: { control: "select", options: ["comfortable", "compact"] } },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScTextAreaStory },
      setup: () => ({ args, updateModel: (modelValue: string) => updateArgs({ modelValue }) }),
      template: "<ScTextAreaStory v-bind='args' @commit:model-value='updateModel' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "문자열 model·전체 오류·native textarea 속성을 제공한다. Enter는 줄바꿈이다. story draft는 즉시 갱신하고 Controls에는 native change(입력 확정/blur)에서 최종값을 반영한다.",
      },
    },
  },
} satisfies Meta<typeof ScTextArea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Multiline: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "업무 설명" });
    await userEvent.type(input, "긴 한국어 설명{Enter}두 번째 줄");
    await userEvent.tab();
    await expect(input).toHaveValue("긴 한국어 설명\n두 번째 줄");
    await expect(canvas.getByRole("status", { name: "설명 미리보기" })).toHaveTextContent(
      "긴 한국어 설명 두 번째 줄",
    );
  },
};
export const TwoErrors: Story = {
  args: { errorMessages: ["업무 설명을 입력해 주세요.", "설명은 200자 이하로 입력해 주세요."] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("textbox", { name: "업무 설명" }),
    ).toHaveAccessibleDescription("업무 설명을 입력해 주세요. 설명은 200자 이하로 입력해 주세요.");
  },
};
export const Readonly: Story = {
  args: { modelValue: "보존할 설명", readonly: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "업무 설명" });
    await userEvent.type(input, "수정 불가");
    await expect(input).toHaveValue("보존할 설명");
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox", { name: "업무 설명" })).toBeDisabled();
  },
};
export const AutoGrow: Story = {
  args: { modelValue: "첫 줄\n둘째 줄\n셋째 줄", rows: 2, autoGrow: true, maxRows: 6 },
};
export const Compact: Story = {
  args: { density: "compact", rows: 2 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "업무 설명" });
    await expect(input.closest(".sc-text-area")).toHaveAttribute("data-density", "compact");
    await userEvent.type(input, "간결한 설명{Enter}둘째 줄");
    await userEvent.tab();
    await expect(input).toHaveValue("간결한 설명\n둘째 줄");
  },
};
