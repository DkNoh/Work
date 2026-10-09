import { afterEach, describe, expect, it } from "vitest";
import { createApp, type App } from "vue";
import ScTextField from "./ScTextField.vue";
import { createScVuetify } from "./theme";

const mounted: { app: App; host: HTMLElement }[] = [];
afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
});

function mountApp(idPrefix?: string) {
  const app = createApp({
    components: { ScTextField },
    template: '<sc-text-field model-value="" label="제목" error-messages="입력 오류" />',
  });
  if (idPrefix !== undefined) app.config.idPrefix = idPrefix;
  const host = document.createElement("div");
  document.body.append(host);
  app.use(createScVuetify()).mount(host);
  mounted.push({ app, host });
  return { app, host };
}

describe("공통 Vuetify의 CSR 입력 ID", () => {
  it("같은 문서의 별도 Vue 앱들도 각각 자신의 label과 오류를 참조한다", () => {
    const first = mountApp();
    const second = mountApp();
    expect(first.app.config.idPrefix).not.toBe(second.app.config.idPrefix);
    const firstInput = first.host.querySelector("input")!;
    const secondInput = second.host.querySelector("input")!;
    expect(firstInput.id).not.toBe(secondInput.id);
    for (const { host } of [first, second]) {
      const input = host.querySelector("input")!;
      expect(
        document.getElementById(input.getAttribute("aria-labelledby")!)?.closest(".sc-text-field"),
      ).toBe(host.firstElementChild);
      expect(
        document.getElementById(input.getAttribute("aria-describedby")!)?.closest(".sc-text-field"),
      ).toBe(host.firstElementChild);
    }
  });

  it("소비자가 명시한 prefix를 유지한다", () => {
    const { app, host } = mountApp("business-app");
    expect(app.config.idPrefix).toBe("business-app");
    expect(host.querySelector("input")!.id).toContain("business-app-");
  });
});
