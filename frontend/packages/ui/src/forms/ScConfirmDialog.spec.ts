import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ScConfirmDialog from "./ScConfirmDialog.vue";
import { createScVuetify } from "../theme";

const global = () => ({ plugins: [createScVuetify()] });

describe("ScConfirmDialog", () => {
  it("부모 model에 맞춰 열고 안전한 취소에 초기 focus·고유 이름/설명·닫힌 뒤 focus를 연결한다", async () => {
    const caller = document.createElement("button");
    caller.textContent = "확인 열기";
    document.body.append(caller);
    caller.focus();
    const wrapper = mount(ScConfirmDialog, {
      attachTo: document.body,
      props: { modelValue: false, title: "입력 취소 확인", message: "작성한 값을 버릴까요?" },
      slots: { default: "확인 전 안내" },
      attrs: {
        "data-dialog": "example",
        role: "alertdialog",
        "aria-label": "잘못된 이름",
        persistent: false,
        "max-width": 10,
      },
      global: global(),
    });
    try {
      const element = wrapper.get("dialog").element as HTMLDialogElement;
      expect(element.open).toBe(false);
      await wrapper.setProps({ modelValue: true });
      expect(element.open).toBe(true);
      expect(document.activeElement).toBe(wrapper.get("button").element);
      expect(document.getElementById(element.getAttribute("aria-labelledby")!)?.textContent).toBe(
        "입력 취소 확인",
      );
      expect(document.getElementById(element.getAttribute("aria-describedby")!)?.textContent).toBe(
        "작성한 값을 버릴까요?",
      );
      expect(wrapper.text()).toContain("확인 전 안내");
      expect(element.getAttribute("data-dialog")).toBe("example");
      for (const attribute of ["role", "aria-label", "persistent", "max-width"])
        expect(element.hasAttribute(attribute)).toBe(false);
      await wrapper.setProps({ modelValue: false });
      expect(element.open).toBe(false);
      expect(document.activeElement).toBe(caller);
    } finally {
      wrapper.unmount();
      caller.remove();
    }
  });

  it("확인은 연속 클릭을 한 번 전달하며 성공·실패 시 닫기 정책은 부모에게 맡긴다", async () => {
    const wrapper = mount(ScConfirmDialog, {
      attachTo: document.body,
      props: { modelValue: true, title: "확인", intent: "danger" },
      global: global(),
    });
    try {
      const confirm = wrapper.findAll("button")[1].element as HTMLButtonElement;
      confirm.click();
      confirm.click();
      expect(wrapper.emitted("confirm")).toEqual([[]]);
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
      expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
      await wrapper.setProps({ busy: true });
      expect(confirm.disabled).toBe(true);
      await wrapper.setProps({ busy: false });
      expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it.each(["button", "escape", "backdrop"] as const)(
    "%s 취소의 reason과 닫기 요청은 emit하고 부모 값 반영 전에는 열린 상태를 유지한다",
    async (reason) => {
      const wrapper = mount(ScConfirmDialog, {
        attachTo: document.body,
        props: { modelValue: true, title: "확인" },
        global: global(),
      });
      try {
        if (reason === "button") await wrapper.get("button").trigger("click");
        if (reason === "escape") await wrapper.get("dialog").trigger("keydown", { key: "Escape" });
        if (reason === "backdrop")
          await wrapper.get("dialog").trigger("click", { clientX: -1, clientY: -1 });
        expect(wrapper.emitted("cancel")).toEqual([[reason]]);
        expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
        expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
        await wrapper.setProps({ modelValue: false });
        expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(false);
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("busy 동안 확인·버튼/Escape/native cancel/배경 취소를 막으며 부모의 명시적인 닫기는 허용한다", async () => {
    const wrapper = mount(ScConfirmDialog, {
      attachTo: document.body,
      props: { modelValue: true, title: "확인", busy: true },
      global: global(),
    });
    try {
      for (const button of wrapper.findAll("button")) (button.element as HTMLButtonElement).click();
      await wrapper.get("dialog").trigger("keydown", { key: "Escape" });
      const cancel = new Event("cancel", { cancelable: true });
      wrapper.get("dialog").element.dispatchEvent(cancel);
      expect(cancel.defaultPrevented).toBe(true);
      await wrapper.get("dialog").trigger("click", { clientX: -1, clientY: -1 });
      for (const event of ["confirm", "cancel", "update:modelValue"])
        expect(wrapper.emitted(event)).toBeUndefined();
      expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(true);
      await wrapper.setProps({ modelValue: false });
      expect((wrapper.get("dialog").element as HTMLDialogElement).open).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("서로 다른 인스턴스의 ID를 구분하고 unmount에서 열린 dialog를 정리한다", () => {
    const first = mount(ScConfirmDialog, {
      attachTo: document.body,
      props: { modelValue: true, title: "첫 확인" },
      global: global(),
    });
    const second = mount(ScConfirmDialog, {
      attachTo: document.body,
      props: { modelValue: false, title: "둘째 확인" },
      global: global(),
    });
    const firstDialog = first.get("dialog").element as HTMLDialogElement;
    try {
      expect(firstDialog.id).not.toBe(second.get("dialog").attributes("id"));
      first.unmount();
      expect(firstDialog.open).toBe(false);
    } finally {
      second.unmount();
      if (first.exists()) first.unmount();
    }
  });
});
