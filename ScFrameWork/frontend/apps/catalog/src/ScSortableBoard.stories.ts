import type { Meta, StoryObj } from "@storybook/vue3-vite";
import type { DefineComponent } from "vue";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ScSortableBoard, type ScSortableBoardProps } from "@sc/ui/board";
import ScSortableBoardStory, { type BoardStoryItem } from "./fixtures/ScSortableBoardStory.vue";
type Args = Partial<ScSortableBoardProps<BoardStoryItem>>;
const meta = {
  title: "확장 UI/ScSortableBoard",
  component: ScSortableBoard as unknown as DefineComponent<Args>,
  args: { label: "중립 이동 보드" },
  render: (args) => ({
    components: { ScSortableBoardStory },
    setup: () => ({ args }),
    template: "<ScSortableBoardStory v-bind='args' />",
  }),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NativeMoveAndConflict: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole("region", { name: "첫 열 (2)" });
    await userEvent.click(canvas.getByRole("button", { name: "Alpha: 아래로" }));
    await expect(
      first.querySelectorAll("[data-sc-board-key]:not([aria-hidden='true'])")[0],
    ).toHaveAttribute("data-sc-board-key", "beta");
    await userEvent.click(canvas.getByRole("button", { name: "저장 충돌 모의" }));
    await userEvent.click(canvas.getByRole("button", { name: "Alpha: 위로" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("409 이동 충돌");
    await expect(
      first.querySelectorAll("[data-sc-board-key]:not([aria-hidden='true'])")[0],
    ).toHaveAttribute("data-sc-board-key", "beta");
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};
export const KeyboardSensorCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("button", { name: "이동: Alpha" });
    handle.focus();
    await userEvent.keyboard(" ");
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-sc-board-key="alpha"]:not([aria-hidden="true"])'),
      ).toHaveClass("sc-board-item--dragging"),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-sc-board-key="alpha"]:not([aria-hidden="true"])'),
      ).not.toHaveClass("sc-board-item--dragging"),
    );
    await expect(canvas.getByRole("status", { name: "이동 의도" })).toBeEmptyDOMElement();
    await expect(handle).toHaveFocus();
  },
};
export const PointerSimulationAndNativeMove: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "isPrimary를 지정한 합성 DOM PointerEvent와 프레임 간격으로 기본 센서의 드래그 시작·열 이동을 검사한 뒤 native 목적 열/이동 버튼으로 복귀합니다. 이 Story는 trusted pointer 입력을 대신하지 않으며, 실제 포인터·키보드는 별도 JAR 칸반 E2E 9개 통과 기록에서 확인합니다. capture나 센서 정책을 mock하지 않습니다.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("button", { name: "이동: Alpha" });
    const empty = canvas.getByRole("region", { name: "둘째 열 (0)" });
    const a = handle.getBoundingClientRect();
    const b = empty.getBoundingClientRect();
    const pointer = {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
    };
    const down = new PointerEvent("pointerdown", {
      ...pointer,
      clientX: a.x + 20,
      clientY: a.y + 15,
    });
    await expect(down.isPrimary).toBe(true);
    await expect(down.isTrusted).toBe(false);
    handle.focus();
    fireEvent(handle, down);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-sc-board-key="alpha"]:not([aria-hidden="true"])'),
      ).toHaveClass("sc-board-item--dragging"),
    );
    fireEvent.pointerMove(empty, {
      ...pointer,
      clientX: b.x + b.width / 2,
      clientY: b.y + b.height / 2,
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fireEvent.pointerUp(empty, {
      ...pointer,
      buttons: 0,
      clientX: b.x + b.width / 2,
      clientY: b.y + b.height / 2,
    });
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-sc-board-key="alpha"]:not([aria-hidden="true"])'),
      ).not.toHaveClass("sc-board-item--dragging"),
    );
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "이동 의도" })).toHaveTextContent(
        '"toColumnId":"second"',
      ),
    );
    await expect(
      JSON.parse(canvas.getByRole("status", { name: "이동 의도" }).textContent!),
    ).toEqual({ itemKey: "alpha", fromColumnId: "first", toColumnId: "second", beforeKey: null });
    await expect(canvas.getByRole("region", { name: "둘째 열 (1)" })).toHaveTextContent("Alpha");
    await expect(canvas.getByRole("region", { name: "첫 열 (1)" })).toHaveTextContent("Beta");
    const row = canvasElement.querySelector<HTMLElement>(
      '[data-sc-board-key="alpha"]:not([aria-hidden="true"])',
    )!;
    await userEvent.selectOptions(within(row).getByLabelText("목적 열"), "first");
    await userEvent.click(within(row).getByRole("button", { name: "Alpha: 이동" }));
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "이동 의도" })).toHaveTextContent(
        '"toColumnId":"first"',
      ),
    );
    await expect(
      JSON.parse(canvas.getByRole("status", { name: "이동 의도" }).textContent!),
    ).toEqual({ itemKey: "alpha", fromColumnId: "second", toColumnId: "first", beforeKey: null });
    const first = canvas.getByRole("region", { name: "첫 열 (2)" });
    await expect(
      Array.from(
        first.querySelectorAll<HTMLElement>("[data-sc-board-key]:not([aria-hidden='true'])"),
      ).map((row) => row.dataset.scBoardKey),
    ).toEqual(["beta", "alpha"]);
    await expect(canvas.getByRole("region", { name: "둘째 열 (0)" })).toHaveTextContent(
      "항목이 없습니다.",
    );
  },
};
export const Readonly: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "이동: Alpha" })).toBeDisabled();
    await expect(canvas.queryByRole("button", { name: "Alpha: 위로" })).toBeNull();
    await expect(canvas.getByRole("link", { name: "Alpha 상세" })).toBeVisible();
  },
};
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("불러오는 중")).toBeVisible();
  },
};
