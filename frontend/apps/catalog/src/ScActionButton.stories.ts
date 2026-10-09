import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import { mdiDownload, mdiRefresh } from "@mdi/js";
import { ScActionButton, uiTokens } from "@sc/ui";
import ScActionButtonStory from "./fixtures/ScActionButtonStory.vue";
import ScActionFormStory from "./fixtures/ScActionFormStory.vue";

const meta = {
  title: "공통 UI/ScActionButton",
  component: ScActionButton,
  args: {
    busy: false,
    disabled: false,
    busyLabel: "저장 중…",
    type: "button",
    size: "md",
    intent: "primary",
    variant: "flat",
  },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    intent: {
      control: "select",
      options: ["primary", "secondary", "success", "warning", "danger", "neutral"],
    },
    variant: { control: "select", options: ["flat", "tonal", "outlined", "text"] },
  },
  render: (args) => ({
    components: { ScActionButtonStory },
    setup: () => ({ args }),
    template: "<ScActionButtonStory v-bind='args' />",
  }),
  parameters: {
    docs: {
      description: {
        component:
          "size(sm/md/lg), intent, variant로 공통 디자인을 선택한다. 화면에서 버튼 내부 CSS를 덮어쓰지 않는다. iconPath는 장식 SVG이고 iconOnly에는 명시적인 aria-label 또는 title을 제공한다. 처리 중 disabled/loading/aria-busy를 제공한다. 업무 저장·오류 처리는 소비 폼의 책임이며 폼 제출은 submit을 명시한다.",
      },
    },
  },
} satisfies Meta<typeof ScActionButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "저장" });
    await expect(getComputedStyle(button).borderRadius).toBe(`${uiTokens.radius.sm}px`);
    await userEvent.click(button);
    await expect(canvas.getByRole("status", { name: "버튼 실행 횟수" })).toHaveTextContent(
      "실행 1회",
    );
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "저장" })).toBeDisabled();
  },
};
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(
      within(canvasElement).getByRole("progressbar", { name: "저장 중…" }),
    ).toBeVisible();
  },
};

export const SmallWithIcon: Story = {
  args: { size: "sm", iconPath: mdiDownload },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "저장" });
    await expect(button).toHaveAttribute("data-size", "sm");
    await expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "버튼 실행 횟수" })).toHaveTextContent(
      "실행 1회",
    );
  },
};
export const Large: Story = { args: { size: "lg" } };
export const SecondaryTonal: Story = {
  args: { intent: "secondary", variant: "tonal" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "저장" })).toHaveAttribute(
      "data-intent",
      "secondary",
    );
  },
};
export const IconOnly: Story = {
  args: { iconOnly: true, iconPath: mdiRefresh },
  render: (args) => ({
    components: { ScActionButtonStory },
    setup: () => ({ args }),
    template: '<ScActionButtonStory v-bind="args" button-label="새로 조회" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "새로 조회" });
    await expect(button).toHaveAttribute("data-icon-only", "true");
    button.focus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("status", { name: "버튼 실행 횟수" })).toHaveTextContent(
      "실행 1회",
    );
  },
};

const formRender: NonNullable<Story["render"]> = (args) => ({
  components: { ScActionFormStory },
  setup: () => ({ args }),
  template: "<ScActionFormStory v-bind='args' />",
});

export const NativeForm: Story = {
  name: "폼·키보드·한 번의 이벤트",
  render: formRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole("button", { name: "동작 실행" });
    const result = canvas.getByRole("status", { name: "폼 동작 결과" });
    const input = canvas.getByRole("textbox", { name: "폼 제목" });
    await userEvent.click(action);
    await expect(result).toHaveTextContent("동작 1회 · 제출 0회 · 초기화 0회");
    action.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(result).toHaveTextContent("동작 3회 · 제출 0회 · 초기화 0회");
    await userEvent.clear(input);
    await userEvent.type(input, "수정 제목");
    await userEvent.click(canvas.getByRole("button", { name: "폼 제출" }));
    await expect(result).toHaveTextContent("동작 3회 · 제출 1회 · 초기화 0회");
    await expect(canvas.getByRole("status", { name: "제출한 제목" })).toHaveTextContent(
      "수정 제목",
    );
    await userEvent.click(canvas.getByRole("button", { name: "폼 초기화" }));
    await expect(input).toHaveValue("처음 제목");
    await expect(result).toHaveTextContent("동작 3회 · 제출 1회 · 초기화 1회");
  },
};

export const SubmitButton: Story = {
  name: "submit 지정",
  args: { type: "submit" },
  render: formRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "동작 실행" }));
    await expect(canvas.getByRole("status", { name: "폼 동작 결과" })).toHaveTextContent(
      "동작 1회 · 제출 1회 · 초기화 0회",
    );
  },
};

export const BusyInForm: Story = {
  name: "처리 중 버튼 동작 차단",
  args: { busy: true },
  render: formRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvasElement.querySelector<HTMLButtonElement>(".sc-action-button")!;
    await expect(button).toBeDisabled();
    button.click();
    await expect(canvas.getByRole("status", { name: "폼 동작 결과" })).toHaveTextContent(
      "동작 0회 · 제출 0회 · 초기화 0회",
    );
  },
};
