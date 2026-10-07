import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScSelect } from "@sc/ui";
import ScSelectStory from "./fixtures/ScSelectStory.vue";

const meta = {
  title: "공통 UI/ScSelect",
  component: ScSelect,
  args: {
    modelValue: null,
    label: "업무 구분",
    density: "comfortable",
    presentation: "field",
    tone: "surface",
    options: [
      { value: "general", label: "일반 업무" },
      { value: "blocked", label: "사용할 수 없는 업무", disabled: true },
      { value: "review", label: "검토 업무" },
    ],
  },
  argTypes: {
    density: { control: "select", options: ["comfortable", "compact"] },
    presentation: { control: "select", options: ["field", "toolbar"] },
    tone: { control: "select", options: ["surface", "primary", "secondary"] },
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScSelectStory },
      setup: () => ({
        args,
        updateModel: (modelValue: string | null) => updateArgs({ modelValue }),
      }),
      // inferred onUpdate:modelValue와 같은 키로 병합해 별도의 kebab listener가 가려지지 않게 한다.
      template: "<ScSelectStory v-bind='args' @update:modelValue='updateModel' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "문자열 ID의 단일 선택. field는 폼 입력, toolbar는 헤더·필터의 native select다. density와 tone으로 공통 크기·색상을 선택하며 임의 화면 CSS로 내부를 덮어쓰지 않는다. options·검증·조회는 소비 폼이 소유한다. readonly/disabled는 변경을 막고 native FormData에는 ID를 제출한다.",
      },
    },
  },
} satisfies Meta<typeof ScSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "업무 구분" });
    input.focus();
    await userEvent.keyboard("{Enter}");
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByRole("listbox")).toBeVisible());
    await expect(page.getByRole("option", { name: "사용할 수 없는 업무" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.keyboard("{End}{Enter}");
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveTextContent("review");
    await expect(input).toHaveAttribute("aria-expanded", "false");
  },
};
export const TwoErrors: Story = {
  args: {
    errorMessages: [
      "업무 구분을 선택해 주세요.",
      "현재 계정의 사용 가능한 업무인지 확인해 주세요.",
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox", { name: "업무 구분" }),
    ).toHaveAccessibleDescription(
      "업무 구분을 선택해 주세요. 현재 계정의 사용 가능한 업무인지 확인해 주세요.",
    );
  },
};
export const Readonly: Story = {
  args: { modelValue: "general", readonly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "업무 구분" });
    input.focus();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveTextContent(
      "general",
    );
  },
};
export const Disabled: Story = {
  args: { modelValue: "general", disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox", { name: "업무 구분" })).toBeDisabled();
  },
};
export const Empty: Story = {
  args: { options: [] },
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole("combobox", { name: "업무 구분" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText("선택할 항목이 없습니다."),
      ).toBeVisible(),
    );
    await userEvent.keyboard("{Escape}");
  },
};
export const Compact: Story = {
  args: { density: "compact", modelValue: "general" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox", { name: "업무 구분" });
    await expect(input.closest(".sc-select")).toHaveAttribute("data-density", "compact");
    await expect(input).toHaveAccessibleName("업무 구분");
  },
};
export const Toolbar: Story = {
  args: {
    presentation: "toolbar",
    density: "compact",
    tone: "primary",
    modelValue: "general",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "업무 구분" });
    await expect(input.tagName).toBe("SELECT");
    await expect(input).toHaveValue("general");
    await expect(canvas.getByRole("option", { name: "사용할 수 없는 업무" })).toBeDisabled();
    input.focus();
    await userEvent.selectOptions(input, "review");
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveTextContent("review");
    await expect(input).toHaveFocus();
  },
};
