import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ScStatusBadge from "./ScStatusBadge.vue";
import { uiTokens } from "../tokens";

function luminance(channels: number[]) {
  const values = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function rgb(hex: string) {
  return hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16));
}

describe("ScStatusBadge의 상태 텍스트와 대비", () => {
  it("상태 문구를 안전한 텍스트로 제공하며 자동 알림 영역을 만들지 않는다", async () => {
    const wrapper = mount(ScStatusBadge, {
      props: { label: '<img src="invalid"> 검토 대기' },
      attrs: {
        id: "request-state",
        "data-state": "review",
        role: "status",
        "aria-live": "polite",
        color: "red",
      },
    });
    expect(wrapper.element.tagName).toBe("SPAN");
    expect(wrapper.text()).toBe('<img src="invalid"> 검토 대기');
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.attributes("data-tone")).toBe("neutral");
    expect(wrapper.attributes("id")).toBe("request-state");
    expect(wrapper.attributes("data-state")).toBe("review");
    expect(wrapper.attributes("role")).toBeUndefined();
    expect(wrapper.attributes("aria-live")).toBeUndefined();
    expect(wrapper.attributes("color")).toBeUndefined();
    await wrapper.setProps({ label: "검토 완료", tone: "success" });
    expect(wrapper.text()).toBe("검토 완료");
    expect(wrapper.attributes("data-tone")).toBe("success");
    wrapper.unmount();
  });

  it("일반 크기의 의미 색상 텍스트는 지정된 밝은 배경에서 4.5:1 이상이다", () => {
    const color = uiTokens.color;
    const tones = [
      color.textMuted,
      color.primary,
      color.secondary,
      color.success,
      color.warning,
      color.error,
      color.info,
    ];
    for (const tone of tones) {
      const tint = rgb(tone).map(
        (channel, index) => channel * 0.08 + rgb(color.surface)[index] * 0.92,
      );
      const foreground = tone === color.secondary ? color.onSecondary : tone;
      const values = [luminance(rgb(foreground)), luminance(tint)].sort((a, b) => b - a);
      expect((values[0] + 0.05) / (values[1] + 0.05), foreground).toBeGreaterThanOrEqual(4.5);
    }
  });
});
