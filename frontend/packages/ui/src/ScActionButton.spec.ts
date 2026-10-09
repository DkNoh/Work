import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import ScActionButton from "./ScActionButton.vue";
import { createScVuetify } from "./theme";
import type { ScActionButtonType } from "./contracts";
import { VBtn } from "vuetify/components";

const global = () => ({ plugins: [createScVuetify()] });

describe("ScActionButton 공개 계약", () => {
  it("장식 아이콘은 접근성 이름을 늘리지 않고 의미 색상보다 명시 color가 우선한다", async () => {
    const wrapper = mount(ScActionButton, {
      props: { intent: "danger", size: "sm", iconPath: "M4 12h16", color: "primary" },
      slots: { default: "저장" },
      global: global(),
    });
    try {
      expect(wrapper.getComponent(VBtn).props("color")).toBe("primary");
      expect(wrapper.get("svg").attributes()).toMatchObject({
        "aria-hidden": "true",
        focusable: "false",
      });
      expect(wrapper.get("button").text()).toBe("저장");
      await wrapper.setProps({ color: undefined, intent: "danger" });
      expect(wrapper.getComponent(VBtn).props("color")).toBe("error");
      await wrapper.setProps({ intent: "secondary", variant: "outlined" });
      expect(wrapper.getComponent(VBtn).props("color")).toBe("info");
    } finally {
      wrapper.unmount();
    }
  });

  it("아이콘 전용 버튼은 title을 이름으로 연결하고 busy 이름과 완료 후 이름을 복원한다", async () => {
    const wrapper = mount(ScActionButton, {
      props: { iconOnly: true, iconPath: "M4 12h16", busyLabel: "새로고침 중" },
      attrs: { title: "새로고침" },
      global: global(),
    });
    try {
      expect(wrapper.get("button").attributes("aria-label")).toBe("새로고침");
      await wrapper.setProps({ busy: true });
      expect(wrapper.get("button").attributes("aria-label")).toBe("새로고침 중");
      expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(true);
      await wrapper.setProps({ busy: false });
      expect(wrapper.get("button").attributes("aria-label")).toBe("새로고침");
    } finally {
      wrapper.unmount();
    }
  });

  it("이름 또는 아이콘이 없는 iconOnly 계약은 빈 버튼으로 렌더하지 않는다", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() =>
        mount(ScActionButton, {
          props: { iconOnly: true, iconPath: "M4 12h16" },
          attrs: { "aria-label": " " },
          global: global(),
        }),
      ).toThrow("requires iconPath");
      expect(() =>
        mount(ScActionButton, {
          props: { iconOnly: true },
          attrs: { title: "열기" },
          global: global(),
        }),
      ).toThrow("requires iconPath");
    } finally {
      warning.mockRestore();
    }
  });
  it("지원 HTML/ARIA/data 갱신만 전달하고 내부 Vuetify 속성과 링크 전환은 차단한다", async () => {
    const attributes = ref({ "aria-label": "첫 이름", "data-view": "first" });
    const clicked = vi.fn();
    const host = {
      components: { ScActionButton },
      setup: () => ({ attributes, clicked }),
      template:
        '<sc-action-button v-bind="attributes" class="host-button" id="save-button" name="action" value="save" form="form-id" title="저장 안내" href="/unexpected" to="/unexpected" tag="a" icon="mdi-check" loading @click="clicked">저장</sc-action-button>',
    };
    const wrapper = mount(host, { attachTo: document.body, global: global() });
    try {
      const button = wrapper.get("button");
      expect(button.attributes()).toMatchObject({
        id: "save-button",
        name: "action",
        value: "save",
        form: "form-id",
        title: "저장 안내",
        type: "button",
        "aria-label": "첫 이름",
        "data-view": "first",
      });
      expect(button.classes()).toContain("host-button");
      expect(button.attributes("href")).toBeUndefined();
      expect(button.attributes("to")).toBeUndefined();
      expect(wrapper.find("a").exists()).toBe(false);
      expect(wrapper.find(".v-icon").exists()).toBe(false);
      expect(wrapper.find("[role=progressbar]").exists()).toBe(false);
      await button.trigger("click");
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(clicked.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
      attributes.value = { "aria-label": "새 이름", "data-view": "updated" };
      await nextTick();
      expect(button.attributes("aria-label")).toBe("새 이름");
      expect(button.attributes("data-view")).toBe("updated");
    } finally {
      wrapper.unmount();
    }
  });

  it("부모 busy가 렌더되기 전의 연속 클릭도 한 번만 전달하고 완료 후 다시 허용한다", async () => {
    const busy = ref(false);
    const save = vi.fn(() => {
      busy.value = true;
    });
    const host = {
      components: { ScActionButton },
      setup: () => ({ busy, save }),
      template: '<sc-action-button :busy="busy" @click="save">저장</sc-action-button>',
    };
    const wrapper = mount(host, { attachTo: document.body, global: global() });
    try {
      const button = wrapper.get("button").element as HTMLButtonElement;
      button.click();
      button.click();
      expect(save).toHaveBeenCalledTimes(1);
      await nextTick();
      expect(button.disabled).toBe(true);
      busy.value = false;
      await nextTick();
      button.click();
      expect(save).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
    }
  });

  it.each([{ disabled: true }, { busy: true }])(
    "잠긴 상태 %j는 native 클릭과 공개 이벤트를 차단한다",
    (state) => {
      const wrapper = mount(ScActionButton, {
        attachTo: document.body,
        props: { ...state, busyLabel: "저장 중…", type: "submit" },
        slots: { default: "저장" },
        global: global(),
      });
      try {
        const event = new MouseEvent("click", { bubbles: true, cancelable: true });
        wrapper.get("button").element.dispatchEvent(event);
        (wrapper.get("button").element as HTMLButtonElement).click();
        expect(wrapper.emitted("click")).toBeUndefined();
        expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(true);
        if (state.busy)
          expect(wrapper.get("[role=progressbar]").attributes("aria-label")).toBe("저장 중…");
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("기본 button은 제출하지 않고 submit/reset은 native HTML form 계약을 유지한다", async () => {
    const type = ref<ScActionButtonType>("button");
    const submit = vi.fn();
    const reset = vi.fn();
    const host = {
      components: { ScActionButton },
      setup: () => ({ type, submit, reset }),
      template:
        '<form @submit.prevent="submit" @reset="reset"><input value="처음"><sc-action-button :type="type">실행</sc-action-button></form>',
    };
    const wrapper = mount(host, { attachTo: document.body, global: global() });
    try {
      const button = wrapper.get("button").element as HTMLButtonElement;
      button.click();
      expect(submit).not.toHaveBeenCalled();
      type.value = "submit";
      await nextTick();
      button.click();
      expect(submit).toHaveBeenCalledTimes(1);
      type.value = "reset";
      await nextTick();
      const input = wrapper.get("input").element as HTMLInputElement;
      input.value = "수정";
      button.click();
      expect(reset).toHaveBeenCalledTimes(1);
      expect(input.value).toBe("처음");
    } finally {
      wrapper.unmount();
    }
  });
});
