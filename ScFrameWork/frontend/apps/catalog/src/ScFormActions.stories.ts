import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import { ScFormActions } from "@sc/ui";
import ScFormActionsStory from "./fixtures/ScFormActionsStory.vue";

const meta = {
  title: "공통 UI/ScFormActions",
  component: ScFormActions,
  args: {
    submitLabel: "폼 저장",
    cancelLabel: "편집 취소",
    busyLabel: "폼 저장 중…",
    busy: false,
    disabled: false,
  },
  render: (args) => ({
    components: { ScFormActionsStory },
    setup: () => ({ args }),
    template: "<ScFormActionsStory v-bind='args' />",
  }),
  parameters: {
    docs: {
      description: {
        component:
          "기본 submit/cancel 버튼과 notice/secondary slot의 배치를 제공한다. 저장·Zod·서버 오류·reset은 부모 form의 책임이다. busy/disabled는 기본 제출·취소를 제한하며 secondary slot의 행동은 소비 폼이 제어한다.",
      },
    },
  },
} satisfies Meta<typeof ScFormActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NativeForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "제출 설명" });
    await userEvent.clear(input);
    await userEvent.type(input, "긴 한국어 설명{Enter}두 번째 줄");
    await userEvent.click(canvas.getByRole("button", { name: "폼 저장" }));
    await expect(canvas.getByRole("status", { name: "공통 폼 행동 결과" })).toHaveTextContent(
      "제출 1회 · 취소 0회",
    );
    await expect(canvas.getByRole("status", { name: "공통 폼 제출 값" })).toHaveTextContent(
      '"category":"general"',
    );
    await expect(canvas.getByRole("status", { name: "공통 폼 제출 값" })).toHaveTextContent(
      '"accepted":"true"',
    );
    await expect(canvas.getByRole("status", { name: "공통 폼 제출 값" })).toHaveTextContent(
      '"description":"긴 한국어 설명\\n두 번째 줄"',
    );
    await userEvent.click(canvas.getByRole("button", { name: "편집 취소" }));
    await expect(canvas.getByRole("status", { name: "공통 폼 행동 결과" })).toHaveTextContent(
      "제출 1회 · 취소 1회",
    );
    await expect(input).toHaveValue("긴 한국어 설명\n두 번째 줄");
    const submit = canvas.getByRole("button", { name: "폼 저장" });
    submit.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "공통 폼 행동 결과" })).toHaveTextContent(
      "제출 2회 · 취소 1회",
    );
  },
};
export const DisabledFormData: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "폼 저장" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "편집 취소" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "폼 값 확인" }));
    await expect(canvas.getByRole("status", { name: "공통 폼 제출 값" })).toHaveTextContent("{}");
  },
};
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "폼 저장 중…" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "편집 취소" })).toBeDisabled();
    await expect(canvas.getByRole("status", { name: "공통 폼 행동 결과" })).toHaveTextContent(
      "제출 0회 · 취소 0회",
    );
  },
};
