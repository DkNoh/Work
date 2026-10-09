import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScCheckbox } from "@sc/ui";
import ScCheckboxStory from "./fixtures/ScCheckboxStory.vue";

const meta = {
  title: "공통 UI/ScCheckbox",
  component: ScCheckbox,
  args: { modelValue: false, label: "입력한 내용을 확인했습니다." },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScCheckboxStory },
      setup: () => ({ args, updateModel: (modelValue: boolean) => updateArgs({ modelValue }) }),
      template: "<ScCheckboxStory v-bind='args' @update:model-value='updateModel' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "boolean 체크 상태를 부모가 소유한다. Space로 전환하며 readonly는 포커스를 유지하고 편집을 막는다. native FormData는 체크된 경우 true, 체크되지 않거나 disabled일 때 필드를 제외한다.",
      },
    },
  },
} satisfies Meta<typeof ScCheckbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "입력한 내용을 확인했습니다." });
    checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox).toBeChecked();
    await expect(canvas.getByRole("status", { name: "체크 미리보기" })).toHaveTextContent("동의함");
    await userEvent.keyboard(" ");
    await expect(checkbox).not.toBeChecked();
  },
};
export const TwoErrors: Story = {
  args: { errorMessages: ["확인 동의가 필요합니다.", "동의 내용의 범위를 확인해 주세요."] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("checkbox", { name: "입력한 내용을 확인했습니다." }),
    ).toHaveAccessibleDescription("확인 동의가 필요합니다. 동의 내용의 범위를 확인해 주세요.");
  },
};
export const Readonly: Story = {
  args: { modelValue: true, readonly: true },
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole("checkbox", {
      name: "입력한 내용을 확인했습니다.",
    });
    checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toHaveFocus();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("checkbox", { name: "입력한 내용을 확인했습니다." }),
    ).toBeDisabled();
  },
};
