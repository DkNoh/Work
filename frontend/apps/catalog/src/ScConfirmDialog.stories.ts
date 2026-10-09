import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScConfirmDialog } from "@sc/ui";
import ScConfirmDialogStory from "./fixtures/ScConfirmDialogStory.vue";

const meta = {
  title: "공통 UI/ScConfirmDialog",
  component: ScConfirmDialog,
  args: {
    modelValue: false,
    title: "미저장 입력 확인",
    message: "작성한 내용을 버리고 이동할까요?",
    confirmLabel: "입력 버리기",
    cancelLabel: "계속 작성",
    busyLabel: "처리 중…",
    intent: "danger",
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScConfirmDialogStory },
      setup: () => ({ args, updateModel: (modelValue: boolean) => updateArgs({ modelValue }) }),
      template: "<ScConfirmDialogStory v-bind='args' @update:model-value='updateModel' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "부모의 열림 model을 native modal dialog에 연결한다. 취소는 reason과 닫기 요청을 emit한다. 확인은 자동으로 닫지 않으며 업무 저장·삭제·Route guard는 부모가 실행한다. 초기 focus는 취소, Tab/역Tab은 내부 순환, 닫힌 뒤 호출 요소로 복귀한다. busy는 모든 사용자 확인·닫기를 막는다.",
      },
    },
  },
} satisfies Meta<typeof ScConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "확인 대화상자 열기" });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole("dialog", { name: "미저장 입력 확인" });
    const cancel = within(dialog).getByRole("button", { name: "계속 작성" });
    const confirm = within(dialog).getByRole("button", { name: "입력 버리기" });
    await expect(dialog).toHaveAccessibleDescription("작성한 내용을 버리고 이동할까요?");
    await expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(confirm).toHaveFocus();
    await userEvent.tab();
    await expect(cancel).toHaveFocus();
    await userEvent.tab();
    await expect(confirm).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toHaveFocus();
    await expect(canvas.getByRole("status", { name: "확인 결과" })).toHaveTextContent(
      "취소(escape) · 확인 0회",
    );
  },
};
export const ParentConfirms: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "확인 대화상자 열기" });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole("dialog", { name: "미저장 입력 확인" });
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 버리기" }));
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toHaveFocus();
    await expect(canvas.getByRole("status", { name: "확인 결과" })).toHaveTextContent(
      "확인 · 확인 1회",
    );
  },
};
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "확인 대화상자 열기" }));
    const dialog = await canvas.findByRole("dialog", { name: "미저장 입력 확인" });
    await expect(within(dialog).getByRole("button", { name: "계속 작성" })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "처리 중…" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getByRole("status", { name: "확인 결과", hidden: true })).toHaveTextContent(
      "선택 전 · 확인 0회",
    );
  },
};
export const FailureStaysOpen: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScConfirmDialogStory },
      setup: () => ({ args, updateModel: (modelValue: boolean) => updateArgs({ modelValue }) }),
      template:
        "<ScConfirmDialogStory v-bind='args' simulate-failure @update:model-value='updateModel' />",
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "확인 대화상자 열기" }));
    const dialog = await canvas.findByRole("dialog", { name: "미저장 입력 확인" });
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 버리기" }));
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByRole("alert")).toHaveTextContent("입력을 보존하고 다시 시도");
    await userEvent.click(within(dialog).getByRole("button", { name: "계속 작성" }));
    await expect(dialog).not.toBeVisible();
  },
};
