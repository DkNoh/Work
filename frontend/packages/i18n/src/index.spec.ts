import { describe, expect, it, vi } from "vitest";
import { createScI18n, commonMessages } from "./index";

describe("독립 다국어 인스턴스", () => {
  it("한/영 전환·앱 메시지 병합·한국어 fallback과 누락 진단을 적용한다", () => {
    const onMissing = vi.fn();
    const i18n = createScI18n({
      messages: { ko: { app: { title: "중립 예제" } }, en: { app: { label: "Sample" } } },
      onMissing,
    });
    expect(i18n.global.t("common.actions.save")).toBe("저장");
    i18n.global.locale.value = "en";
    expect(i18n.global.t("common.actions.save")).toBe("Save");
    expect(i18n.global.t("app.label")).toBe("Sample");
    expect(i18n.global.t("app.title")).toBe("중립 예제");
    expect(i18n.global.t("app.absent")).toBe("app.absent");
    expect(onMissing).toHaveBeenCalledWith("en", "app.absent");
  });

  it("두 앱의 locale·메시지를 격리하고 원본 공통/앱 메시지를 바꾸지 않는다", () => {
    const overrides = Object.freeze({
      common: Object.freeze({ actions: Object.freeze({ save: "등록" }) }),
    });
    const first = createScI18n({ messages: { ko: overrides } });
    const second = createScI18n();
    expect(first.global.t("common.actions.save")).toBe("등록");
    expect(first.global.t("common.actions.cancel")).toBe("취소");
    first.global.locale.value = "en";
    expect(second.global.locale.value).toBe("ko");
    expect(second.global.t("common.actions.save")).toBe("저장");
    expect(commonMessages.ko.common.actions.save).toBe("저장");
    expect(overrides.common.actions.save).toBe("등록");
  });
});
