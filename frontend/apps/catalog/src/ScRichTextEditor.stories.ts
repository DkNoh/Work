import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, within } from "storybook/test";
import { ScRichTextEditor, type ScRichTextDocument } from "@sc/ui/editor";
import ScRichTextEditorStory from "./fixtures/ScRichTextEditorStory.vue";

const meta = {
  title: "확장 UI/ScRichTextEditor",
  component: ScRichTextEditor,
  args: {
    label: "본문",
    modelValue: { type: "doc", content: [{ type: "paragraph" }] },
    hint: "JSON을 앱이 소유하며 저장 API는 에디터에 포함하지 않습니다.",
    placeholder: "내용을 입력하세요.",
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScRichTextEditorStory },
      setup: () => ({
        args,
        commit: (modelValue: ScRichTextDocument) => updateArgs({ modelValue }),
      }),
      template: "<ScRichTextEditorStory v-bind='args' @commit:model-value='commit' />",
    };
  },
} satisfies Meta<typeof ScRichTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditAndValidate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "본문" });
    await expect(input).toHaveAccessibleDescription(
      "JSON을 앱이 소유하며 저장 API는 에디터에 포함하지 않습니다.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "굵게" }));
    await userEvent.type(input, "한국어 서식 입력");
    await expect(canvas.getByLabelText("문서 JSON")).toHaveTextContent('"type":"bold"');
    await expect(canvas.getByLabelText("문서 JSON")).toHaveTextContent("한국어 서식 입력");
    await userEvent.click(canvas.getByRole("button", { name: "부모 문서 교체" }));
    await expect(input).toHaveTextContent("부모에서 받은 새 문서");
    await expect(canvas.getByRole("link", { name: "부모에서 받은 새 문서" })).toHaveAttribute(
      "href",
      "/safe-guide",
    );
    await userEvent.click(canvas.getByRole("button", { name: "잘못된 문서 전달" }));
    await expect(input).toHaveTextContent("부모에서 받은 새 문서");
    await expect(canvas.getByRole("status", { name: "문서 검증" })).toHaveTextContent(
      "허용하지 않는 링크 주소",
    );
    await expect(canvasElement.querySelector('a[href^="javascript:"]')).toBeNull();
  },
};
export const Readonly: Story = {
  args: {
    readonly: true,
    modelValue: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "읽기 전용 문서" }] }],
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "본문" });
    await expect(input).toHaveAttribute("contenteditable", "false");
    await expect(input).toHaveAttribute("aria-readonly", "true");
    await userEvent.click(input);
    await userEvent.keyboard("변경할 수 없음");
    await expect(input).toHaveTextContent("읽기 전용 문서");
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "본문" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(canvas.getByRole("button", { name: "굵게" })).toBeDisabled();
  },
};
export const FieldError: Story = {
  args: { errorMessages: ["본문을 확인해 주세요.", "둘째 필드 오류"] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("textbox", { name: "본문" }),
    ).toHaveAccessibleDescription(
      "JSON을 앱이 소유하며 저장 API는 에디터에 포함하지 않습니다. 본문을 확인해 주세요. 둘째 필드 오류",
    );
  },
};
export const FormattingHistory: Story = {
  args: {
    modelValue: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "서식 이력 문서" }] }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "본문" });
    await userEvent.click(input);
    const listButton = canvas.getByRole("button", { name: "글머리 기호" });
    listButton.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("문서 JSON")).toHaveTextContent('"type":"bulletList"');
    await userEvent.click(canvas.getByRole("button", { name: "실행 취소" }));
    await expect(canvas.getByLabelText("문서 JSON")).not.toHaveTextContent('"type":"bulletList"');
    await userEvent.click(canvas.getByRole("button", { name: "다시 실행" }));
    await expect(canvas.getByLabelText("문서 JSON")).toHaveTextContent('"type":"bulletList"');
    await expect(input).toHaveTextContent("서식 이력 문서");
  },
};
