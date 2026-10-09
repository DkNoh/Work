import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ScKpiCard from "./ScKpiCard.vue";

describe("ScKpiCard의 지표와 장식 경계", () => {
  it("지표 이름·값·방향 문구를 텍스트로 제공하고 두 아이콘은 읽기 순서에서 제외한다", async () => {
    const wrapper = mount(ScKpiCard, {
      props: {
        label: "처리한 요청",
        value: "1,248건",
        trend: "전월보다 2.5% 증가",
        trendDirection: "up",
        note: "이번 달",
        iconPath: "M4 4h16v16H4z",
      },
      attrs: { "data-metric": "processed", "aria-labelledby": "external", density: "compact" },
    });
    const heading = wrapper.get("h2");
    expect(heading.text()).toBe("처리한 요청");
    expect(wrapper.attributes("aria-labelledby")).toBe(heading.attributes("id"));
    expect(wrapper.get(".sc-kpi-card__value").text()).toBe("1,248건");
    expect(wrapper.get(".sc-kpi-card__trend").text()).toBe("전월보다 2.5% 증가");
    expect(wrapper.get(".sc-kpi-card__note").text()).toBe("이번 달");
    expect(wrapper.get(".sc-kpi-card__icon").attributes("aria-hidden")).toBe("true");
    expect(wrapper.get(".sc-kpi-card__decoration").attributes("aria-hidden")).toBe("true");
    expect(wrapper.attributes("data-metric")).toBe("processed");
    expect(wrapper.attributes("density")).toBeUndefined();
    expect(wrapper.attributes("data-density")).toBe("compact");
    await wrapper.setProps({ value: "1,249건", trend: "전월보다 1% 감소", trendDirection: "down" });
    expect(wrapper.get(".sc-kpi-card__value").text()).toBe("1,249건");
    expect(wrapper.get(".sc-kpi-card__trend").text()).toBe("전월보다 1% 감소");
    wrapper.unmount();
  });

  it("기본 밀도를 유지하고 compact 전환에도 지표의 의미와 제목 참조를 보존한다", async () => {
    const wrapper = mount(ScKpiCard, {
      props: { label: "요청 건수", value: "124건" },
    });
    const titleId = wrapper.get("h2").attributes("id");
    expect(wrapper.attributes("data-density")).toBe("comfortable");
    await wrapper.setProps({ density: "compact" });
    expect(wrapper.attributes("data-density")).toBe("compact");
    expect(wrapper.get(".sc-kpi-card__value").text()).toBe("124건");
    expect(wrapper.attributes("aria-labelledby")).toBe(titleId);
    wrapper.unmount();
  });
});
