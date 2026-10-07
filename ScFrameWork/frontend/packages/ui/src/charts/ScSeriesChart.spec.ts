import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import ScSeriesChart from "./ScSeriesChart.vue";
import type { ScChartSeries } from "./contracts";

const PlotStub = defineComponent({
  name: "ScSeriesPlotStub",
  props: {
    option: { type: Object, required: true },
    initOptions: { type: Object, required: true },
    autoresize: Boolean,
  },
  template: '<div data-plot-stub="true" />',
});
const series: readonly ScChartSeries[] = Object.freeze([
  Object.freeze({
    name: "완료",
    color: "#7f67ff",
    data: Object.freeze([
      { label: "1월", value: 12 },
      { label: "2월", value: 18 },
    ]),
  }),
  Object.freeze({
    name: "검토",
    color: "#03b562",
    data: Object.freeze([
      { label: "1월", value: 8 },
      { label: "2월", value: 15 },
    ]),
  }),
]);
const global = { stubs: { Echarts: PlotStub } };

describe("ScSeriesChart의 공개 자료와 접근성 대안", () => {
  it("두 시리즈의 SVG 옵션과 이름·값을 같은 순서의 표로 제공한다", () => {
    const wrapper = mount(ScSeriesChart, {
      props: { label: "월별 처리량", series, categoryLabel: "월" },
      global,
    });
    expect(wrapper.get("figure").attributes("aria-labelledby")).toBe(
      wrapper.get("figcaption").attributes("id"),
    );
    expect(wrapper.get("figcaption").text()).toBe("월별 처리량");
    expect(wrapper.get(".sc-series-chart__plot").attributes("aria-hidden")).toBe("true");
    const plot = wrapper.findComponent(PlotStub);
    expect(plot.props("initOptions")).toEqual({ renderer: "svg" });
    expect(plot.props("option")).toMatchObject({
      xAxis: { data: ["1월", "2월"] },
      series: [
        { name: "완료", type: "line", data: [12, 18], itemStyle: { color: "#7f67ff" } },
        { name: "검토", type: "line", data: [8, 15], itemStyle: { color: "#03b562" } },
      ],
    });
    expect(wrapper.get("table caption").text()).toBe("월별 처리량");
    expect(wrapper.findAll('th[scope="col"]').map((cell) => cell.text())).toEqual([
      "월",
      "완료",
      "검토",
    ]);
    expect(wrapper.findAll('th[scope="row"]').map((cell) => cell.text())).toEqual(["1월", "2월"]);
    expect(wrapper.findAll("td").map((cell) => cell.text())).toEqual(["12", "8", "18", "15"]);
    expect(wrapper.get("details summary").text()).toBe("차트 데이터 보기");
    wrapper.unmount();
  });

  it("기간·개수·유한 수·시리즈 이름이 잘못되면 차트와 표를 만들지 않는다", () => {
    const invalid: readonly { name: string; series: readonly ScChartSeries[] }[] = [
      {
        name: "다른 기간",
        series: [
          series[0]!,
          {
            ...series[1]!,
            data: [
              { label: "다른 월", value: 8 },
              { label: "2월", value: 15 },
            ],
          },
        ],
      },
      { name: "다른 개수", series: [series[0]!, { ...series[1]!, data: [] }] },
      {
        name: "NaN",
        series: [
          {
            ...series[0]!,
            data: [
              { label: "1월", value: NaN },
              { label: "2월", value: 18 },
            ],
          },
        ],
      },
      { name: "중복 이름", series: [series[0]!, { ...series[1]!, name: "완료" }] },
      { name: "빈 이름", series: [{ ...series[0]!, name: "  " }] },
    ];
    for (const scenario of invalid) {
      const wrapper = mount(ScSeriesChart, {
        props: { label: scenario.name, series: scenario.series },
        global,
      });
      expect(wrapper.get('[role="alert"]').text(), scenario.name).toBe(
        "차트 자료의 형식이 올바르지 않습니다.",
      );
      expect(wrapper.findComponent(PlotStub).exists(), scenario.name).toBe(false);
      expect(wrapper.find("table").exists(), scenario.name).toBe(false);
      wrapper.unmount();
    }
  });

  it("허용 DOM 속성만 전달하고 빈 자료 전환 때 기존 차트·표를 제거한다", async () => {
    const wrapper = mount(ScSeriesChart, {
      props: { label: "월별 처리량", series },
      attrs: {
        "data-metric": "throughput",
        "aria-describedby": "metric-help",
        theme: "raw-theme",
        option: { series: "raw-options" },
      },
      global,
    });
    expect(wrapper.attributes("data-metric")).toBe("throughput");
    expect(wrapper.attributes("aria-describedby")).toBe("metric-help");
    expect(wrapper.attributes("theme")).toBeUndefined();
    expect(wrapper.attributes("option")).toBeUndefined();
    expect(wrapper.findComponent(PlotStub).props("option")).toMatchObject({
      series: [{ name: "완료" }, { name: "검토" }],
    });
    await wrapper.setProps({ series: [] });
    expect(wrapper.get('[role="status"]').text()).toBe("표시할 데이터가 없습니다.");
    expect(wrapper.findComponent(PlotStub).exists()).toBe(false);
    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
