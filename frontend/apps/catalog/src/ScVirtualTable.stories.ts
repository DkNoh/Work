import type { Meta, StoryObj } from "@storybook/vue3-vite";
import type { DefineComponent } from "vue";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScVirtualTable, type ScVirtualTableProps } from "@sc/ui/table";
import type { TableExampleRow } from "./fixtures/ScTableData";
import ScVirtualTableStory from "./fixtures/ScVirtualTableStory.vue";

type StoryArgs = Partial<ScVirtualTableProps<TableExampleRow>> & { longRows?: boolean };

const meta = {
  title: "공통 UI/ScVirtualTable",
  component: ScVirtualTable as unknown as DefineComponent<StoryArgs>,
  render: (args) => ({
    components: { ScVirtualTableStory },
    setup: () => ({ args }),
    template: "<ScVirtualTableStory v-bind='args' />",
  }),
  parameters: {
    docs: {
      description: {
        component:
          "10,000행 실제 windowing·native table·1행 focus pin·일반 페이지 표 대안. 현재 viewport 480px/최소행48px/overscan8의 data row DOM 상한64를 확인한다.",
      },
    },
  },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TenThousandScrollSelectionAndFallback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByRole("region", { name: "10,000행 자료 표 영역" });
    const table = canvas.getByRole("table", { name: "10,000행 자료" });
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-00000"]')).toBeInTheDocument(),
    );
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    const counts = [viewport.querySelectorAll("[data-row-key]").length];
    await expect(viewport.querySelectorAll("[data-row-key]").length).toBeLessThanOrEqual(64);
    await userEvent.click(canvas.getByRole("checkbox", { name: "자료 0 선택" }));
    const selected = canvas.getByRole("checkbox", { name: "자료 0 선택" });
    selected.focus();
    // pointer 스크롤 중 포커스 행 하나를 유지한다. 현재 창 전체를 선택 DOM으로 고정하지 않는다.
    viewport.scrollTop = viewport.scrollHeight / 2;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-05000"]')).toBeInTheDocument(),
    );
    await expect(selected).toHaveFocus();
    counts.push(viewport.querySelectorAll("[data-row-key]").length);
    await expect(viewport.querySelectorAll("[data-row-key]").length).toBeLessThanOrEqual(64);
    await expect(viewport.querySelector('[data-row-key="row-05000"]')).toHaveTextContent(
      "자료 5000",
    );
    await userEvent.click(canvas.getByRole("button", { name: "마지막 행으로 이동" }));
    await waitFor(() =>
      expect(canvas.getByRole("checkbox", { name: "자료 9999 선택" })).toHaveFocus(),
    );
    await expect(viewport.querySelector('[data-row-key="row-09999"]')).toHaveAttribute(
      "aria-rowindex",
      "10001",
    );
    counts.push(viewport.querySelectorAll("[data-row-key]").length);
    await userEvent.click(canvas.getByRole("button", { name: "첫 행으로 이동" }));
    await waitFor(() =>
      expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toHaveFocus(),
    );
    await expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeChecked();
    // 클릭으로 포커스를 옮기지 않고 부모의 controlled sorting 변경을 검사한다.
    await userEvent.keyboard("{F6}");
    await waitFor(() =>
      expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toHaveFocus(),
    );
    await expect(viewport.querySelector('[data-row-key="row-00000"]')).toHaveAttribute(
      "aria-rowindex",
      "10001",
    );
    await expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeChecked();
    counts.push(viewport.querySelectorAll("[data-row-key]").length);
    await expect(Math.max(...counts)).toBeLessThanOrEqual(64);
    canvasElement.dataset.scVirtualMetrics = JSON.stringify({
      component: "ScVirtualTable",
      rows: 10000,
      viewport: 480,
      minimumRow: 48,
      overscan: 8,
      firstMiddleLastSorted: counts,
      maximum: Math.max(...counts),
    });
    await userEvent.click(canvas.getByRole("button", { name: "일반 페이지 표 보기" }));
    await waitFor(() =>
      expect(canvasElement.querySelectorAll("tbody [data-row-key]")).toHaveLength(20),
    );
    await expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "가상 스크롤 보기" }));
    await waitFor(() =>
      expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeChecked(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "가상 표 해제" }));
    await expect(canvas.queryByRole("table", { name: "10,000행 자료" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "가상 표 다시 연결" }));
    await waitFor(() =>
      expect(canvas.getByRole("table", { name: "10,000행 자료" })).toBeInTheDocument(),
    );
  },
};
export const VariableHeightResizeAndReplacement: Story = {
  args: { longRows: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByRole("region", { name: "10,000행 자료 표 영역" });
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-00000"]')).toBeInTheDocument(),
    );
    const first = viewport.querySelector<HTMLElement>('[data-row-key="row-00000"]')!;
    const before = first.getBoundingClientRect().height;
    const checkbox = first.querySelector<HTMLInputElement>("input")!;
    await userEvent.click(checkbox);
    await userEvent.click(canvas.getByRole("button", { name: "390px 폭 전환" }));
    await waitFor(() => expect(first.getBoundingClientRect().height).toBeGreaterThan(before));
    await expect(viewport.clientWidth).toBeLessThanOrEqual(390);
    await expect(viewport.querySelectorAll("[data-row-key]").length).toBeLessThanOrEqual(64);
    first.querySelector<HTMLButtonElement>('button[data-sc-focus="open"]')!.focus();
    await userEvent.keyboard("{F7}");
    await waitFor(() =>
      expect(document.activeElement?.closest("[data-row-key]")).toHaveAttribute(
        "data-row-key",
        "row-00000",
      ),
    );
    await expect(first).toHaveTextContent("갱신");
    await expect(first.querySelector("input")).toBeChecked();
    await expect(first.querySelector('button[data-sc-focus="open"]')).toHaveFocus();
    canvasElement.dataset.scVirtualResizeMetrics = JSON.stringify({
      before,
      after: first.getBoundingClientRect().height,
      width: viewport.clientWidth,
      dataDOM: viewport.querySelectorAll("[data-row-key]").length,
    });
    await userEvent.click(canvas.getByRole("button", { name: "마지막 행으로 이동" }));
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-09999"]')).toBeInTheDocument(),
    );
    await expect(viewport.querySelector('[data-row-key="row-09999"]')).toHaveTextContent(
      "자료 9999",
    );
  },
};
