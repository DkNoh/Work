import { describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createScI18n } from "@sc/i18n";
import { createScVuetify } from "@sc/ui";
import ScheduleForm from "./ScheduleForm.vue";
import type { Schedule } from "./api";
const initial: Schedule = {
  id: 7,
  jobCode: "PULSE",
  cron: "0 17 * * * ?",
  timeZone: "UTC",
  misfirePolicy: "SKIP",
  enabled: false,
  revision: 3,
  createdAt: "2026-10-07T00:00:00Z",
  updatedAt: "2026-10-07T00:00:00Z",
  nextFireAt: null,
};
function setup() {
  const i18n = createScI18n();
  const wrapper = mount(ScheduleForm, {
    props: {
      initial,
      resetKey: 1,
      jobs: [{ jobCode: "PULSE", executionMode: "TRANSACTIONAL" }],
      busy: false,
      readonly: false,
      serverErrors: {},
    },
    global: { plugins: [i18n, createScVuetify()] },
  });
  return { wrapper, i18n };
}
describe("예약 입력의 원본과 revision 기준", () => {
  it("Query 자료·언어가 바뀌어도 초안과 제출 revision을 유지하고 명시 reset만 교체한다", async () => {
    const { wrapper, i18n } = setup();
    try {
      const cronInput = wrapper
        .findAll("input")
        .find((input) => input.element.getAttribute("maxlength") === "120")!;
      await cronInput.setValue("0 29 * * * ?");
      await flushPromises();
      await wrapper.setProps({ initial: { ...initial, cron: "0 19 * * * ?", revision: 4 } });
      i18n.global.locale.value = "en";
      await flushPromises();
      expect((cronInput.element as HTMLInputElement).value).toBe("0 29 * * * ?");
      expect(wrapper.get("[data-testid='schedule-revision']").text()).toBe("3");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.emitted("save")?.at(-1)).toEqual([
        {
          jobCode: "PULSE",
          cron: "0 29 * * * ?",
          timeZone: "UTC",
          misfirePolicy: "SKIP",
          enabled: false,
        },
        3,
      ]);
      await wrapper.setProps({ resetKey: 2 });
      await flushPromises();
      expect((cronInput.element as HTMLInputElement).value).toBe("0 19 * * * ?");
      expect(wrapper.get("[data-testid='schedule-revision']").text()).toBe("4");
      expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([false]);
    } finally {
      wrapper.unmount();
    }
  });
  it("서버 필드 오류·읽기 전용·잘못된 timezone은 입력을 보존하고 저장을 차단한다", async () => {
    const { wrapper } = setup();
    try {
      const zone = wrapper
        .findAll("input")
        .find((input) => input.element.getAttribute("maxlength") === "64")!;
      await zone.setValue("Invalid/PrivateZone");
      await flushPromises();
      await wrapper.setProps({ serverErrors: { timeZone: "서버 시간대 오류" } });
      expect((zone.element as HTMLInputElement).value).toBe("Invalid/PrivateZone");
      expect(wrapper.text()).toContain("서버 시간대 오류");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.emitted("save")).toBeUndefined();
      await zone.setValue("UTC");
      await wrapper.setProps({ readonly: true });
      await wrapper.get("form").trigger("submit");
      expect(wrapper.emitted("save")).toBeUndefined();
      expect(initial.timeZone).toBe("UTC");
      expect(initial.revision).toBe(3);
    } finally {
      wrapper.unmount();
    }
  });
});
