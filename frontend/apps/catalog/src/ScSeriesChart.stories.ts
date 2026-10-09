import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getInstanceByDom } from "echarts/core";
import { ScSeriesChart, type ScChartSeries } from "@sc/ui/charts";
import ScSeriesChartStory from "./fixtures/ScSeriesChartStory.vue";

const series = [
  {
    name: "완료",
    color: "#7f67ff",
    data: [
      { label: "1월", value: 12 },
      { label: "2월", value: 18 },
      { label: "3월", value: 24 },
      { label: "4월", value: 35 },
    ],
  },
  {
    name: "검토",
    color: "#03b562",
    data: [
      { label: "1월", value: 8 },
      { label: "2월", value: 15 },
      { label: "3월", value: 12 },
      { label: "4월", value: 20 },
    ],
  },
] satisfies readonly ScChartSeries[];

const meta = {
  title: "확장 UI/ScSeriesChart",
  component: ScSeriesChart,
  args: { label: "월별 처리량", series, height: 320 },
  render: (args) => ({
    components: { ScSeriesChartStory },
    setup: () => ({ args }),
    template: '<ScSeriesChartStory v-bind="args" />',
  }),
} satisfies Meta<typeof ScSeriesChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoSeries: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("figure", { name: "월별 처리량" })).toBeVisible();
    await userEvent.click(canvas.getByText("차트 데이터 보기", { selector: "summary" }));
    const table = canvas.getByRole("table", { name: "월별 처리량" });
    await expect(within(table).getByRole("columnheader", { name: "기간" })).toBeVisible();
    await expect(within(table).getByRole("columnheader", { name: "완료" })).toBeVisible();
    await expect(within(table).getByRole("columnheader", { name: "검토" })).toBeVisible();
    await expect(
      within(table).getByRole("rowheader", { name: "4월" }).closest("tr"),
    ).toHaveTextContent("35");
    await expect(
      within(table).getByRole("rowheader", { name: "4월" }).closest("tr"),
    ).toHaveTextContent("20");
    const host = canvasElement.querySelector<HTMLElement>(".sc-series-chart__plot .echarts-host")!;
    await waitFor(() =>
      expect(getInstanceByDom(host)?.getOption().series).toMatchObject([
        { name: "완료", type: "line", data: [12, 18, 24, 35], itemStyle: { color: "#7f67ff" } },
        { name: "검토", type: "line", data: [8, 15, 12, 20], itemStyle: { color: "#03b562" } },
      ]),
    );
    await expect(host.querySelector("svg")).not.toBeNull();
    await expect(canvasElement.querySelector(".sc-series-chart__plot")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  },
};
export const Empty: Story = {
  args: { series: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("표시할 데이터가 없습니다.");
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument();
    await expect(canvasElement.querySelector(".sc-series-chart__plot")).toBeNull();
  },
};
export const InvalidLabels: Story = {
  args: {
    series: [
      series[0],
      {
        ...series[1],
        data: series[1].data.map((item, index) =>
          index === 1 ? { ...item, label: "다른 기간" } : item,
        ),
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "차트 자료의 형식이 올바르지 않습니다.",
    );
    await expect(canvasElement.querySelector(".sc-series-chart__plot")).toBeNull();
  },
};
export const InvalidCount: Story = {
  args: { series: [series[0], { ...series[1], data: series[1].data.slice(0, 2) }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "차트 자료의 형식이 올바르지 않습니다.",
    );
    await expect(canvasElement.querySelector(".sc-series-chart__plot")).toBeNull();
  },
};
export const EnglishTable: Story = {
  args: {
    label: "Monthly throughput",
    dataLabel: "Show chart data",
    categoryLabel: "Month",
    emptyLabel: "No data to display.",
    invalidLabel: "The chart data format is invalid.",
    series: series.map((line, index) => ({
      ...line,
      name: index === 0 ? "Completed" : "In review",
      data: line.data.map((item, itemIndex) => ({
        ...item,
        label: ["Jan", "Feb", "Mar", "Apr"][itemIndex]!,
      })),
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByText("Show chart data", { selector: "summary" });
    summary.focus();
    await expect(summary).toHaveFocus();
    // 합성 keyboard의 summary 기본 동작은 실제 Playwright 키보드 검사에서 확인한다.
    await userEvent.click(summary);
    const table = canvas.getByRole("table", { name: "Monthly throughput" });
    await expect(within(table).getByRole("columnheader", { name: "Month" })).toBeVisible();
    await expect(within(table).getByRole("columnheader", { name: "Completed" })).toBeVisible();
    await expect(within(table).getByRole("columnheader", { name: "In review" })).toBeVisible();
    await expect(within(table).getByRole("rowheader", { name: "Apr" })).toBeVisible();
  },
};
