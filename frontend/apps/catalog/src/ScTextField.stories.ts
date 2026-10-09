import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScTextField, uiTokens } from "@sc/ui";
import ScTextFieldStory from "./fixtures/ScTextFieldStory.vue";

const meta = {
  title: "공통 UI/ScTextField",
  component: ScTextField,
  args: { modelValue: "", label: "제목", density: "comfortable" },
  argTypes: { density: { control: "select", options: ["comfortable", "compact"] } },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScTextFieldStory },
      setup: () => ({ args, updateModel: (modelValue: string) => updateArgs({ modelValue }) }),
      template: "<ScTextFieldStory v-bind='args' @commit:model-value='updateModel' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "modelValue/update:modelValue와 label/errorMessages를 연결한다. density는 기본 comfortable과 업무 필터용 compact를 제공한다. 내부 CSS를 화면에서 덮어쓰지 않는다. Zod·VeeValidate·서버 필드 오류는 업무 폼이 소유한다.",
      },
    },
  },
} satisfies Meta<typeof ScTextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "제목" });
    const field = input.closest(".v-field")!;
    await expect(getComputedStyle(field).borderRadius).toBe(`${uiTokens.radius.sm}px`);
    const outline = getComputedStyle(field.querySelector(".v-field__outline__start")!);
    const channels = uiTokens.color.controlBorder
      .slice(1)
      .match(/.{2}/g)!
      .map((part) => parseInt(part, 16));
    await expect(outline.borderTopColor).toBe(`rgb(${channels.join(", ")})`);
    await expect(outline.opacity).toBe("1");
    await userEvent.type(input, "긴 한국어 제목");
    await userEvent.tab();
    await expect(canvas.getByRole("status", { name: "입력 미리보기" })).toHaveTextContent(
      "긴 한국어 제목",
    );
  },
};
export const FieldError: Story = {
  args: { errorMessages: "제목을 입력해 주세요." },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("textbox", { name: "제목" }),
    ).toHaveAccessibleDescription("제목을 입력해 주세요.");
  },
};
export const Readonly: Story = {
  args: { modelValue: "읽기 전용 예제", readonly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "제목" });
    await expect(input).toHaveAttribute("readonly");
    await userEvent.type(input, "덧붙일 수 없음");
    await expect(input).toHaveValue("읽기 전용 예제");
    await expect(canvas.getByRole("status", { name: "입력 미리보기" })).toHaveTextContent(
      "읽기 전용 예제",
    );
  },
};
export const Disabled: Story = {
  args: { modelValue: "비활성 예제", disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox", { name: "제목" })).toBeDisabled();
  },
};
export const Compact: Story = {
  args: { density: "compact", modelValue: "공통 입력" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "제목" });
    await expect(input.closest(".sc-text-field")).toHaveAttribute("data-density", "compact");
    await userEvent.clear(input);
    await userEvent.type(input, "간결한 조회 조건");
    await userEvent.tab();
    await expect(canvas.getByRole("status", { name: "입력 미리보기" })).toHaveTextContent(
      "간결한 조회 조건",
    );
  },
};
