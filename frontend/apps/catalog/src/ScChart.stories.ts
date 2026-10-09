import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getInstanceByDom } from "echarts/core";
import { ScChart } from "@sc/ui/charts";
import ScChartStory from "./fixtures/ScChartStory.vue";
import ScChartComparisonStory from "./fixtures/ScChartComparisonStory.vue";

const meta = {
  title: "확장 UI/ScChart",
  component: ScChart,
  args: {
    label: "합성 수량",
    summary: "업무 API와 분리한 월별 합성 자료",
    data: [
      { label: "1월", value: 8 },
      { label: "2월", value: 12 },
    ],
  },
  render: (args) => ({
    components: { ScChartStory },
    setup: () => ({ args }),
    template: "<ScChartStory v-bind='args' />",
  }),
} satisfies Meta<typeof ScChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BarAndLine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("차트 데이터", { selector: "summary" }));
    await expect(canvas.getByRole("table")).toHaveTextContent("1월");
    await userEvent.click(canvas.getByRole("button", { name: "자료 변경" }));
    await expect(canvas.getByRole("table")).toHaveTextContent("갱신한 항목");
    const host = canvasElement.querySelector<HTMLElement>(".echarts-host")!;
    await waitFor(() =>
      expect(getInstanceByDom(host)?.getOption().series).toMatchObject([
        { type: "bar", data: [15, 8] },
      ]),
    );
    await userEvent.click(canvas.getByRole("button", { name: "선/막대 전환" }));
    await waitFor(() =>
      expect(getInstanceByDom(host)?.getOption().series).toMatchObject([{ type: "line" }]),
    );
    const instance = getInstanceByDom(host)!;
    await userEvent.click(canvas.getByRole("button", { name: "폭 변경" }));
    await waitFor(() => expect(instance.getWidth()).toBeLessThanOrEqual(280));
    await expect(instance.getWidth()).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "표시 전환" }));
    await waitFor(() => expect(instance.isDisposed()).toBe(true));
    await userEvent.click(canvas.getByRole("button", { name: "표시 전환" }));
    await waitFor(() => expect(canvasElement.querySelector(".echarts-host svg")).not.toBeNull());
  },
};
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status", { name: "" })).toHaveTextContent(
      "불러오는 중",
    );
  },
};
export const Empty: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("표시할 데이터가 없습니다.")).toBeVisible();
  },
};
export const RequestError: Story = {
  args: { error: "합성 조회 오류" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("합성 조회 오류");
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(canvas.getByRole("status", { name: "차트 재시도" })).toHaveTextContent("1");
  },
};
export const KeyboardSelection: Story = {
  args: { selectable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("차트 데이터", { selector: "summary" }));
    const button = canvas.getByRole("button", { name: "선택 1월" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "차트 선택" })).toHaveTextContent("1월: 8");
  },
};
export const MultipleInstances: Story = {
  render: (args) => ({
    components: { ScChartComparisonStory },
    setup: () => ({ args }),
    template: "<ScChartComparisonStory v-bind='args' />",
  }),
  play: async ({ canvasElement }) => {
    const hosts = canvasElement.querySelectorAll<HTMLElement>(".echarts-host");
    await expect(hosts).toHaveLength(2);
    await waitFor(() =>
      expect(getInstanceByDom(hosts[0]!)?.getOption().series).toMatchObject([{ data: [8, 12] }]),
    );
    await waitFor(() =>
      expect(getInstanceByDom(hosts[1]!)?.getOption().series).toMatchObject([
        { type: "line", data: [16, 24] },
      ]),
    );
    await expect(getInstanceByDom(hosts[0]!)).not.toBe(getInstanceByDom(hosts[1]!));
  },
};
