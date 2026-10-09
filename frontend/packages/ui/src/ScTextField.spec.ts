import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { VTextField } from "vuetify/components";
import ScTextField from "./ScTextField.vue";
import { createScVuetify } from "./theme";

const global = () => ({ plugins: [createScVuetify()] });

describe("ScTextField 공개 계약", () => {
  it("입력 변경을 emit하고 사용자 설명과 서버 필드 오류를 같은 입력에 연결한다", async () => {
    const help = document.createElement("p");
    help.id = "contract-help";
    help.textContent = "추가 입력 안내";
    document.body.append(help);
    const errors = Object.freeze(["제목 오류", "두 번째 오류", ""]);
    const wrapper = mount(ScTextField, {
      attachTo: document.body,
      props: {
        modelValue: "초기 입력",
        label: "제목",
        id: "contract-title",
        errorMessages: errors,
      },
      attrs: { "aria-describedby": "contract-help contract-title-messages" },
      global: global(),
    });
    try {
      const input = wrapper.get("input");
      await input.setValue("수정 입력");
      expect(wrapper.emitted("update:modelValue")).toEqual([["수정 입력"]]);
      expect(input.attributes("id")).toBe("contract-title");
      expect(input.attributes("aria-labelledby")).toBe("contract-title-label");
      expect(input.attributes("aria-invalid")).toBe("true");
      expect(input.attributes("aria-describedby")).toBe("contract-help contract-title-messages");
      expect(document.getElementById("contract-title-label")?.textContent).toContain("제목");
      expect(document.getElementById("contract-title-messages")?.textContent).toContain(
        "제목 오류",
      );
      expect(document.getElementById("contract-title-messages")?.textContent).toContain(
        "두 번째 오류",
      );
      expect(errors).toEqual(["제목 오류", "두 번째 오류", ""]);
    } finally {
      wrapper.unmount();
      help.remove();
    }
  });

  it("자동 ID는 인스턴스별로 구분하고 각 오류 설명에 연결한다", () => {
    const first = mount(ScTextField, {
      attachTo: document.body,
      props: { modelValue: "", label: "첫 제목", errorMessages: "첫 오류" },
      global: global(),
    });
    const second = mount(ScTextField, {
      attachTo: document.body,
      props: { modelValue: "", label: "둘째 제목", errorMessages: "둘째 오류" },
      global: global(),
    });
    try {
      const ids = [first.get("input").attributes("id"), second.get("input").attributes("id")];
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids.every((id) => id.startsWith("sc-field-"))).toBe(true);
      expect(
        document.getElementById(first.get("input").attributes("aria-describedby"))?.textContent,
      ).toBe("첫 오류");
      expect(
        document.getElementById(second.get("input").attributes("aria-describedby"))?.textContent,
      ).toBe("둘째 오류");
    } finally {
      first.unmount();
      second.unmount();
    }
  });

  it("native 입력 props·ARIA는 입력에, class/data는 wrapper에 전달하고 private Vuetify 속성은 차단한다", () => {
    const wrapper = mount(ScTextField, {
      attachTo: document.body,
      props: {
        modelValue: "",
        label: "비밀번호",
        type: "password",
        name: "password",
        autocomplete: "current-password",
        form: "login-form",
        placeholder: "입력 예",
        maxLength: 200,
        minLength: 2,
        pattern: ".{2,}",
        inputMode: "text",
        required: true,
        errorMessages: "입력 오류",
      },
      attrs: {
        class: "host-field",
        "data-field": "password",
        "aria-describedby": "external-help",
        "aria-invalid": false,
        role: "searchbox",
        variant: "plain",
        clearable: true,
        "hide-details": true,
      },
      global: global(),
    });
    try {
      const input = wrapper.get("input");
      expect(input.attributes()).toMatchObject({
        type: "password",
        name: "password",
        autocomplete: "current-password",
        form: "login-form",
        placeholder: "입력 예",
        maxlength: "200",
        minlength: "2",
        pattern: ".{2,}",
        inputmode: "text",
        "aria-required": "true",
        "aria-invalid": "true",
      });
      expect((input.element as HTMLInputElement).required).toBe(true);
      expect(input.attributes("data-field")).toBeUndefined();
      expect(wrapper.find("[role=searchbox]").exists()).toBe(false);
      expect(wrapper.attributes("data-field")).toBe("password");
      expect(wrapper.classes()).toContain("host-field");
      expect(wrapper.classes()).toContain("v-input--density-comfortable");
      expect(wrapper.find(".v-field--variant-outlined").exists()).toBe(true);
      expect(wrapper.find(".v-field__clearable").exists()).toBe(false);
      expect(wrapper.text()).toContain("입력 오류");
    } finally {
      wrapper.unmount();
    }
  });

  it("compact 선택은 이름·오류·native 입력 계약을 유지하고 기본 comfortable로 복원할 수 있다", async () => {
    const wrapper = mount(ScTextField, {
      attachTo: document.body,
      props: {
        modelValue: "보존",
        label: "제목",
        density: "compact",
        errorMessages: "오류",
        name: "title",
      },
      global: global(),
    });
    try {
      expect(wrapper.classes()).toContain("v-input--density-compact");
      expect(wrapper.get("input").attributes("name")).toBe("title");
      expect(wrapper.get("input").attributes("aria-invalid")).toBe("true");
      await wrapper.get("input").setValue("새 입력");
      expect(wrapper.emitted("update:modelValue")).toEqual([["새 입력"]]);
      await wrapper.setProps({ density: "comfortable" });
      expect(wrapper.classes()).toContain("v-input--density-comfortable");
    } finally {
      wrapper.unmount();
    }
  });

  it.each(["readonly", "disabled"] as const)(
    "%s는 자식의 프로그램 편집을 막고 부모의 새 값은 표시한다",
    async (state) => {
      const wrapper = mount(ScTextField, {
        attachTo: document.body,
        props: { modelValue: "기존 값", label: "제목", [state]: true },
        global: global(),
      });
      try {
        wrapper.getComponent(VTextField).vm.$emit("update:modelValue", "프로그램 편집");
        await wrapper.get("input").trigger("input");
        await wrapper.get("input").trigger("change");
        expect(wrapper.emitted("update:modelValue")).toBeUndefined();
        expect(wrapper.emitted("input")).toBeUndefined();
        expect(wrapper.emitted("change")).toBeUndefined();
        await wrapper.setProps({ modelValue: "부모에서 받은 새 값" });
        expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
          "부모에서 받은 새 값",
        );
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("focus/blur·키보드·입력 이벤트를 한 번씩 전달하고 ARIA/data만 바꿔도 반영한다", async () => {
    const attributes = ref({ "aria-describedby": "first-help", "data-view": "first" });
    const value = ref("");
    const focused = vi.fn();
    const blurred = vi.fn();
    const host = {
      components: { ScTextField },
      setup: () => ({ attributes, value, focused, blurred }),
      template:
        '<sc-text-field v-bind="attributes" v-model="value" label="제목" hint="입력 안내" @focus="focused" @blur="blurred" />',
    };
    const wrapper = mount(host, { attachTo: document.body, global: global() });
    try {
      const input = wrapper.get("input");
      await input.trigger("focus");
      await input.trigger("keydown", { key: "a" });
      await input.trigger("keyup", { key: "a" });
      await input.setValue("입력");
      await input.trigger("blur");
      const field = wrapper.getComponent(ScTextField);
      expect(focused).toHaveBeenCalledTimes(1);
      expect(blurred).toHaveBeenCalledTimes(1);
      expect(field.emitted("keydown")).toHaveLength(1);
      expect(field.emitted("keyup")).toHaveLength(1);
      expect(field.emitted("input")).toHaveLength(1);
      expect(field.emitted("change")).toHaveLength(1);
      expect(value.value).toBe("입력");
      attributes.value = { "aria-describedby": "next-help", "data-view": "updated" };
      await nextTick();
      expect(input.attributes("aria-describedby")).toBe("next-help");
      expect(field.attributes("data-view")).toBe("updated");
    } finally {
      wrapper.unmount();
    }
  });
});
