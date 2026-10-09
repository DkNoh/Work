import type { Meta, StoryObj } from "@storybook/vue3-vite";
import type { DefineComponent } from "vue";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScVirtualList, type ScVirtualListProps } from "@sc/ui/table";
import type { TableExampleRow } from "./fixtures/ScTableData";
import ScVirtualListStory from "./fixtures/ScVirtualListStory.vue";

type StoryArgs = Partial<ScVirtualListProps<TableExampleRow>>;

const meta = {
  title: "공통 UI/ScVirtualList",
  component: ScVirtualList as unknown as DefineComponent<StoryArgs>,
  render: () => ({ components: { ScVirtualListStory }, template: "<ScVirtualListStory />" }),
  parameters: {
    docs: {
      description: {
        component:
          "native ul/li, 전체 위치 ARIA와 키 기반 포커스. 행 탐색 버튼에만 Arrow/Home/End를 적용한다.",
      },
    },
  },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TenThousandKeyboardAndCleanup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByRole("region", { name: "10,000개 자료 목록 스크롤 영역" });
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-00000"]')).toBeInTheDocument(),
    );
    await expect(viewport.querySelectorAll("[data-row-key]").length).toBeLessThanOrEqual(64);
    const counts = [viewport.querySelectorAll("[data-row-key]").length];
    const first = canvas.getByRole("button", { name: "자료 0" });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "자료 1" })).toHaveFocus());
    viewport.scrollTop = viewport.scrollHeight / 2;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(viewport.querySelector('[data-row-key="row-05000"]')).toBeInTheDocument(),
    );
    await expect(canvas.getByRole("button", { name: "자료 1" })).toHaveFocus();
    counts.push(viewport.querySelectorAll("[data-row-key]").length);
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "자료 9999" })).toHaveFocus());
    await expect(viewport.querySelector('[data-row-key="row-09999"]')).toHaveAttribute(
      "aria-posinset",
      "10000",
    );
    counts.push(viewport.querySelectorAll("[data-row-key]").length);
    await expect(Math.max(...counts)).toBeLessThanOrEqual(64);
    canvasElement.dataset.scVirtualMetrics = JSON.stringify({
      component: "ScVirtualList",
      rows: 10000,
      viewport: 480,
      minimumRow: 48,
      overscan: 8,
      firstMiddleLast: counts,
      maximum: Math.max(...counts),
    });
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "자료 0" })).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "가상 목록 해제" }));
    await expect(
      canvas.queryByRole("region", { name: "10,000개 자료 목록 스크롤 영역" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "가상 목록 다시 연결" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "자료 0" })).toBeInTheDocument());
  },
};
