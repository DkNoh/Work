import type { Meta, StoryObj } from "@storybook/vue3-vite";
import type { DefineComponent } from "vue";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScDataTable, type ScDataTableProps } from "@sc/ui/table";
import type { TableExampleRow } from "./fixtures/ScTableData";
import ScDataTableStory from "./fixtures/ScDataTableStory.vue";

type StoryArgs = Partial<ScDataTableProps<TableExampleRow>> & { empty?: boolean };

const meta = {
  title: "공통 UI/ScDataTable",
  component: ScDataTable as unknown as DefineComponent<StoryArgs>,
  args: {
    selectedKeys: ["outside-page"],
    sorting: null,
    pagination: { pageIndex: 0, pageSize: 10, total: 45 },
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScDataTableStory },
      setup: () => ({
        args,
        changeSelection: (selectedKeys: string[]) => updateArgs({ selectedKeys }),
        changeSort: (sorting: StoryArgs["sorting"]) => updateArgs({ sorting }),
        changePage: (pagination: StoryArgs["pagination"]) => updateArgs({ pagination }),
      }),
      template:
        "<ScDataTableStory v-bind='args' @update:selected-keys='changeSelection' @change-sort='changeSort' @change-pagination='changePage' />",
    };
  },
  parameters: {
    docs: {
      description: {
        component:
          "native table과 controlled 정렬/페이지/선택. 앱이 Query/Router/권한을 소유하며 cells는 SFC slot으로 작성한다.",
      },
    },
  },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ClientSortingAndSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("table", { name: "공통 표 자료" });
    await expect(table.querySelectorAll("tbody [data-row-key]")).toHaveLength(10);
    await userEvent.click(canvas.getByRole("checkbox", { name: "자료 0 선택" }));
    await expect(canvas.getByRole("status", { name: "선택 ID" })).toHaveTextContent(
      "outside-page, row-00000",
    );
    await expect(canvas.getByRole("checkbox", { name: "자료 2 선택" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "다음 페이지" }));
    await expect(canvas.getByRole("checkbox", { name: "자료 10 선택" })).not.toBeChecked();
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "현재 조회된 선택 가능한 행 모두 선택" }),
    );
    await expect(canvas.getByRole("status", { name: "선택 ID" })).toHaveTextContent("row-00000");
    await userEvent.click(canvas.getByRole("button", { name: "이전 페이지" }));
    await expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "금액: 오름차순 정렬" }));
    await userEvent.click(canvas.getByRole("button", { name: "금액: 내림차순 정렬" }));
    await waitFor(() =>
      expect(table.querySelector("tbody [data-row-key]")?.getAttribute("data-row-key")).toBe(
        "row-00044",
      ),
    );
    await expect(table.querySelector('[aria-sort="descending"]')).toHaveTextContent("금액");
    const action = canvas.getByRole("button", { name: "자료 44 열기" });
    action.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "행 열기" })).toHaveTextContent("row-00044");
  },
};
export const ServerResponse: Story = {
  args: { dataMode: "server" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다음 페이지" }));
    await expect(canvas.getByRole("checkbox", { name: "자료 10 선택" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "금액: 오름차순 정렬" }));
    await expect(canvas.getByRole("checkbox", { name: "자료 0 선택" })).toBeInTheDocument();
  },
};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { empty: true } };
export const ErrorAndRetry: Story = {
  args: { error: "조회에 실패했습니다." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("조회에 실패했습니다.");
    await userEvent.click(canvas.getByRole("button", { name: "다시 조회" }));
    await expect(canvas.getByText("재조회 요청 전달됨")).toBeInTheDocument();
  },
};
