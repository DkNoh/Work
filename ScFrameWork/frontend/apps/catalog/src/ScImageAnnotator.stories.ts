import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ref } from "vue";
import { ScImageAnnotator, type ScNormalizedBox } from "@sc/ui/image";
import ScImageAnnotatorStory from "./fixtures/ScImageAnnotatorStory.vue";
const meta = {
  title: "확장 UI/ScImageAnnotator",
  component: ScImageAnnotator,
  args: { image: null, imageDescription: "실제 PNG 예제", modelValue: null },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScImageAnnotatorStory },
      setup: () => ({
        args,
        change: (modelValue: ScNormalizedBox | null) => updateArgs({ modelValue }),
      }),
      template: "<ScImageAnnotatorStory v-bind='args' @update:modelValue='change' />",
    };
  },
} satisfies Meta<typeof ScImageAnnotator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CoordinatesAndSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText("가로 시작")).toBeEnabled());
    for (const [label, value] of [
      ["가로 시작", "0.1"],
      ["세로 시작", "0.2"],
      ["너비", "0.3"],
      ["높이", "0.4"],
    ]) {
      await userEvent.clear(canvas.getByLabelText(label!));
      await userEvent.type(canvas.getByLabelText(label!), value!);
    }
    await userEvent.click(canvas.getByRole("button", { name: "좌표 적용" }));
    await expect(canvas.getByRole("status", { name: "저장할 좌표" })).toHaveTextContent(
      '"width":0.3',
    );
    await userEvent.click(canvas.getByRole("button", { name: "기존 주석 1" }));
    await expect(canvas.getByRole("button", { name: "기존 주석 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.clear(canvas.getByLabelText("너비"));
    await userEvent.type(canvas.getByLabelText("너비"), "0.95");
    await userEvent.click(canvas.getByRole("button", { name: "좌표 적용" }));
    await expect(canvas.getByRole("alert")).toBeVisible();
    await expect(canvas.getByRole("status", { name: "저장할 좌표" })).toHaveTextContent(
      '"width":0.3',
    );
  },
};
export const PointerDrawing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector("canvas")).not.toBeNull());
    const node = canvasElement.querySelector("canvas")!;
    const rect = node.getBoundingClientRect();
    await userEvent.pointer([
      {
        target: node,
        coords: { clientX: rect.x + rect.width * 0.1, clientY: rect.y + rect.height * 0.1 },
        keys: "[MouseLeft>]",
      },
      {
        target: node,
        coords: { clientX: rect.x + rect.width * 0.4, clientY: rect.y + rect.height * 0.4 },
      },
      {
        target: node,
        coords: { clientX: rect.x + rect.width * 0.4, clientY: rect.y + rect.height * 0.4 },
        keys: "[/MouseLeft]",
      },
    ]);
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "저장할 좌표" })).not.toHaveTextContent(
        "박스 없음",
      ),
    );
    const output = JSON.parse(canvas.getByRole("status", { name: "저장할 좌표" }).textContent!);
    await expect(output.x).toBeCloseTo(0.1, 2);
    await expect(output.width).toBeCloseTo(0.3, 2);
  },
};
export const Readonly: Story = {
  args: { readonly: true, modelValue: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector("canvas")).not.toBeNull());
    await expect(canvas.getByRole("button", { name: "좌표 적용" })).toBeDisabled();
    await expect(canvas.getByLabelText("가로 시작")).toHaveValue(0.1);
    await userEvent.click(canvas.getByRole("button", { name: "기존 주석 1" }));
    await expect(canvas.getByRole("button", { name: "기존 주석 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
export const MoveResizeAndZoom: Story = {
  args: { modelValue: { x: 0.1, y: 0.1, width: 0.25, height: 0.3 } },
  parameters: {
    docs: {
      description: {
        story:
          "확대는 native range에 합성 input 이벤트를 전달하는 Storybook 시뮬레이션입니다. 합성 keydown은 브라우저의 range 기본 동작을 수행하지 않습니다. 실제 canvas의 합성 포인터 이동·크기 변경을 검사하며 trusted 키보드·포인터·Escape는 별도 JAR E2E에서 검증합니다.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText("가로 시작")).toBeEnabled());
    const node = canvasElement.querySelector("canvas")!;
    const initialWidth = node.getBoundingClientRect().width;
    const readBox = (): ScNormalizedBox =>
      JSON.parse(canvas.getByRole("status", { name: "저장할 좌표" }).textContent!);
    const zoom = canvas.getByRole("slider", { name: "확대" });
    // range의 UA 키보드 기본 동작은 별도 Playwright에서 검사한다.
    fireEvent.input(zoom, { target: { value: "1.25" } });
    await waitFor(() => expect(zoom).toHaveValue("1.25"));
    await waitFor(() => expect(node.getBoundingClientRect().width).toBeGreaterThan(initialWidth));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await expect(readBox()).toEqual({ x: 0.1, y: 0.1, width: 0.25, height: 0.3 });
    const pointerAt = (x: number, y: number) => {
      const bounds = node.getBoundingClientRect();
      return { clientX: bounds.x + bounds.width * x, clientY: bounds.y + bounds.height * y };
    };
    // 실제 canvas에 합성 DOM 포인터를 보내 Konva 이동·Transformer 경로를 검사한다.
    await userEvent.pointer([
      { target: node, coords: pointerAt(0.225, 0.25), keys: "[MouseLeft>]" },
      { target: node, coords: pointerAt(0.325, 0.35) },
      { target: node, coords: pointerAt(0.325, 0.35), keys: "[/MouseLeft]" },
    ]);
    await waitFor(() => expect(readBox().x).toBeCloseTo(0.2, 2));
    await expect(readBox().y).toBeCloseTo(0.2, 2);
    const moved = readBox();
    // 변경한 박스의 hit canvas와 Transformer anchor가 그려진 뒤 다음 gesture를 시작한다.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await userEvent.pointer([
      {
        target: node,
        coords: pointerAt(moved.x + moved.width, moved.y + moved.height),
        keys: "[MouseLeft>]",
      },
      {
        target: node,
        coords: pointerAt(moved.x + moved.width + 0.05, moved.y + moved.height + 0.05),
      },
      {
        target: node,
        coords: pointerAt(moved.x + moved.width + 0.05, moved.y + moved.height + 0.05),
        keys: "[/MouseLeft]",
      },
    ]);
    await waitFor(() => expect(readBox().width).toBeGreaterThan(moved.width));
    await expect(readBox().height).toBeGreaterThan(moved.height);
    await expect(readBox().x).toBeCloseTo(moved.x, 2);
    await expect(readBox().y).toBeCloseTo(moved.y, 2);
    await expect(readBox().x + readBox().width).toBeLessThanOrEqual(1);
    await expect(readBox().y + readBox().height).toBeLessThanOrEqual(1);
    await expect(canvasElement.querySelector("canvas")!.isConnected).toBe(true);
  },
};
export const Empty: Story = {
  args: { imageDescription: "빈 이미지", image: null },
  render: (args) => ({
    components: { ScImageAnnotator },
    setup: () => ({ args }),
    template: "<sc-image-annotator v-bind='args' />",
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("이미지가 없습니다.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "좌표 적용" })).toBeDisabled();
    await expect(canvasElement.querySelector("canvas")).toBeNull();
  },
};
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("불러오는 중")).toBeVisible();
  },
};
export const ErrorAndRetry: Story = {
  args: { imageDescription: "불러오지 못한 이미지", error: "이미지 불러오기 실패" },
  render: (args) => ({
    components: { ScImageAnnotator },
    setup: () => ({ args, attempts: ref(0) }),
    template:
      "<sc-image-annotator v-bind='args' @retry='attempts++' /><output role='status' aria-label='재시도 요청'>{{ attempts }}</output>",
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("이미지 불러오기 실패");
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(canvas.getByRole("status", { name: "재시도 요청" })).toHaveTextContent("1");
  },
};
