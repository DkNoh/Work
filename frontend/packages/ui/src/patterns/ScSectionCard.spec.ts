import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ScSectionCard from "./ScSectionCard.vue";

describe("ScSectionCard의 공개 표현과 의미", () => {
  it("기본 표현과 제목 참조를 유지하며 슬롯과 HTML 속성을 전달한다", async () => {
    const wrapper = mount(ScSectionCard, {
      props: { title: "최근 업무", description: "변경한 항목을 확인하세요." },
      attrs: { "data-source": "requests", "aria-labelledby": "external", elevation: 5 },
      slots: { default: "업무 내용", actions: '<button type="button">전체 보기</button>' },
    });
    expect(wrapper.attributes("data-density")).toBe("comfortable");
    expect(wrapper.attributes("data-surface")).toBe("bordered");
    expect(wrapper.attributes("aria-labelledby")).toBe(wrapper.get("h2").attributes("id"));
    expect(wrapper.attributes("data-source")).toBe("requests");
    expect(wrapper.attributes("elevation")).toBeUndefined();
    expect(wrapper.get("p").text()).toBe("변경한 항목을 확인하세요.");
    expect(wrapper.get("button").text()).toBe("전체 보기");
    expect(wrapper.get(".sc-section-card__body").text()).toBe("업무 내용");
    const titleId = wrapper.get("h2").attributes("id");
    await wrapper.setProps({ title: "요청 현황", density: "compact", surface: "plain" });
    expect(wrapper.attributes("data-density")).toBe("compact");
    expect(wrapper.attributes("data-surface")).toBe("plain");
    expect(wrapper.get("h2").text()).toBe("요청 현황");
    expect(wrapper.get("h2").attributes("id")).toBe(titleId);
    expect(wrapper.get("button").text()).toBe("전체 보기");
    wrapper.unmount();
  });
});
