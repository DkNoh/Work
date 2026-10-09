import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { VCheckbox, VSelect, VTextarea } from "vuetify/components";
import { createScVuetify } from "../theme";
import ScSelect from "./ScSelect.vue";
import ScCheckbox from "./ScCheckbox.vue";
import ScTextArea from "./ScTextArea.vue";

const global = () => ({ plugins: [createScVuetify()] });
const options = Object.freeze([
  Object.freeze({ value: "first", label: "첫 항목" }),
  Object.freeze({ value: "second", label: "둘째 항목" }),
  Object.freeze({ value: "blocked", label: "선택 불가", disabled: true }),
]);

describe("005 입력 공개 계약", () => {
  it("세 입력의 고유 ID·label·전체 오류와 외부 설명을 연결하고 props를 변경하지 않는다", () => {
    const errors = Object.freeze(["첫 필드 오류", "둘째 필드 오류", ""]);
    const wrapper = mount(
      {
        components: { ScSelect, ScCheckbox, ScTextArea },
        setup: () => ({ options, errors }),
        template: `<section>
        <p id="additional-help">추가 안내</p>
        <sc-select :model-value="'first'" :options="options" label="구분" :error-messages="errors" aria-describedby="additional-help" />
        <sc-checkbox :model-value="false" label="동의" :error-messages="errors" aria-describedby="additional-help" />
        <sc-text-area :model-value="''" label="설명" :error-messages="errors" aria-describedby="additional-help" />
      </section>`,
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const ids = wrapper.findAll("input:not([type=hidden]), textarea").map((field) => {
        const id = field.attributes("id");
        const describedBy = field.attributes("aria-describedby");
        expect(id.startsWith("sc-")).toBe(true);
        expect(field.attributes("aria-invalid")).toBe("true");
        expect(describedBy).toBe(`additional-help ${id}-messages`);
        expect(document.getElementById(`${id}-messages`)?.textContent).toContain("첫 필드 오류");
        expect(document.getElementById(`${id}-messages`)?.textContent).toContain("둘째 필드 오류");
        expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
        return id;
      });
      expect(new Set(ids).size).toBe(3);
      expect(errors).toEqual(["첫 필드 오류", "둘째 필드 오류", ""]);
      expect(options[2].disabled).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it("native form은 선택 ID·체크 true·다중 줄을 제출하고 disabled 값은 제외한다", async () => {
    const disabled = ref(false);
    const description = "첫 줄\n둘째 줄";
    const wrapper = mount(
      {
        components: { ScSelect, ScCheckbox, ScTextArea },
        setup: () => ({ options, disabled, description }),
        template: `<form id="input-contract-form">
        <sc-select :model-value="'second'" :options="options" label="구분" name="category" :disabled="disabled" />
        <sc-checkbox :model-value="true" label="동의" name="accepted" :disabled="disabled" />
        <sc-text-area :model-value="description" label="설명" name="description" :disabled="disabled" />
      </form>`,
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const form = wrapper.get("form").element as HTMLFormElement;
      const data = new FormData(form);
      expect(data.get("category")).toBe("second");
      expect(data.get("accepted")).toBe("true");
      expect(data.get("description")).toBe("첫 줄\n둘째 줄");
      disabled.value = true;
      await nextTick();
      expect((wrapper.get("textarea").element as HTMLTextAreaElement).disabled).toBe(true);
      // Happy DOM은 disabled textarea도 FormData에 포함한다. 실제 브라우저 story에서 제외를 확인한다.
      expect(new FormData(form).has("category")).toBe(false);
      expect(new FormData(form).has("accepted")).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("외부 form ID로 입력을 연결하며 readonly 값은 제출한다", () => {
    const wrapper = mount(
      {
        components: { ScSelect, ScCheckbox, ScTextArea },
        setup: () => ({ options }),
        template: `<section>
        <form id="outside-input-form"></form>
        <sc-select :model-value="'first'" :options="options" label="구분" form="outside-input-form" name="category" readonly />
        <sc-checkbox :model-value="true" label="동의" form="outside-input-form" name="accepted" readonly />
        <sc-text-area :model-value="'보존 입력'" label="설명" form="outside-input-form" name="description" readonly />
      </section>`,
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const data = new FormData(wrapper.get("form").element as HTMLFormElement);
      expect(Object.fromEntries(data)).toEqual({
        category: "first",
        accepted: "true",
        description: "보존 입력",
      });
    } finally {
      wrapper.unmount();
    }
  });

  it("attrs만 갱신해도 반영하고 내부 props·역할·ARIA 상태 우회를 차단한다", async () => {
    const attrs = ref({ "aria-describedby": "first-help", "data-input": "first" });
    const wrapper = mount(
      {
        components: { ScSelect, ScCheckbox, ScTextArea },
        setup: () => ({ options, attrs }),
        template: `<section>
        <sc-select v-bind="attrs" :model-value="'first'" :options="options" label="구분" role="searchbox" density="compact" multiple :aria-expanded="true" />
        <sc-checkbox v-bind="attrs" :model-value="false" label="동의" role="switch" :aria-checked="true" indeterminate />
        <sc-text-area v-bind="attrs" :model-value="''" label="설명" role="searchbox" variant="plain" :aria-invalid="true" />
      </section>`,
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const select = wrapper.get(".sc-select input:not([type=hidden])");
      expect(select.attributes("role")).toBe("combobox");
      expect(select.attributes("aria-expanded")).toBe("false");
      expect(wrapper.get(".sc-select").classes()).toContain("v-input--density-compact");
      expect(wrapper.get(".sc-select").classes()).not.toContain("v-select--multiple");
      expect(wrapper.find("[role=searchbox], [role=switch]").exists()).toBe(false);
      expect((wrapper.get(".sc-checkbox input").element as HTMLInputElement).checked).toBe(false);
      expect(wrapper.get(".sc-checkbox input").attributes("aria-checked")).not.toBe("true");
      expect(wrapper.get("textarea").attributes("aria-invalid")).toBeUndefined();
      attrs.value = { "aria-describedby": "next-help", "data-input": "updated" };
      await nextTick();
      for (const selector of [
        ".sc-select input:not([type=hidden])",
        ".sc-checkbox input",
        "textarea",
      ]) {
        expect(wrapper.get(selector).attributes("aria-describedby")).toBe("next-help");
      }
      for (const selector of [".sc-select", ".sc-checkbox", ".sc-text-area"]) {
        expect(wrapper.get(selector).attributes("data-input")).toBe("updated");
      }
    } finally {
      wrapper.unmount();
    }
  });

  it.each(["readonly", "disabled"] as const)(
    "%s는 프로그램 편집을 차단하고 부모 모델 갱신은 표시한다",
    async (state) => {
      const selected = ref("first");
      const checked = ref(false);
      const text = ref("보존");
      const wrapper = mount(
        {
          components: { ScSelect, ScCheckbox, ScTextArea },
          setup: () => ({ options, state, selected, checked, text }),
          template: `<section>
        <sc-select v-model="selected" :options="options" label="구분" :readonly="state==='readonly'" :disabled="state==='disabled'" />
        <sc-checkbox v-model="checked" label="동의" :readonly="state==='readonly'" :disabled="state==='disabled'" />
        <sc-text-area v-model="text" label="설명" :readonly="state==='readonly'" :disabled="state==='disabled'" />
      </section>`,
        },
        { attachTo: document.body, global: global() },
      );
      try {
        wrapper.getComponent(VSelect).vm.$emit("update:modelValue", "second");
        wrapper.getComponent(VCheckbox).vm.$emit("update:modelValue", true);
        wrapper.getComponent(VTextarea).vm.$emit("update:modelValue", "변경");
        for (const field of [
          wrapper.getComponent(ScSelect),
          wrapper.getComponent(ScCheckbox),
          wrapper.getComponent(ScTextArea),
        ]) {
          expect(field.emitted("update:modelValue")).toBeUndefined();
          expect(field.emitted("change")).toBeUndefined();
        }
        const select = wrapper.getComponent(ScSelect);
        const checkbox = wrapper.getComponent(ScCheckbox);
        const area = wrapper.getComponent(ScTextArea);
        selected.value = "second";
        checked.value = true;
        text.value = "외부 모델";
        await nextTick();
        expect((select.get("input:not([type=hidden])").element as HTMLInputElement).value).toBe(
          "둘째 항목",
        );
        expect((checkbox.get("input").element as HTMLInputElement).checked).toBe(true);
        expect((area.get("textarea").element as HTMLTextAreaElement).value).toBe("외부 모델");
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("Select는 동일·없는·disabled 옵션을 emit하지 않고 활성 선택은 모델과 change로 전달한다", () => {
    const wrapper = mount(ScSelect, {
      props: { modelValue: "first", label: "구분", options },
      global: global(),
    });
    try {
      const select = wrapper.getComponent(VSelect);
      for (const value of ["first", "unknown", "blocked", { value: "second" }])
        select.vm.$emit("update:modelValue", value);
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
      select.vm.$emit("update:modelValue", "second");
      expect(wrapper.emitted("update:modelValue")).toEqual([["second"]]);
      expect(wrapper.emitted("change")).toEqual([["second"]]);
    } finally {
      wrapper.unmount();
    }
  });

  it("toolbar native 선택도 label·오류·명시 변화·키보드 이벤트와 disabled 옵션을 보존한다", async () => {
    const selected = ref<string | null>("first");
    const wrapper = mount(
      {
        components: { ScSelect },
        setup: () => ({ options, selected }),
        template:
          '<section><p id="toolbar-help">도움말</p><sc-select v-model="selected" :options="options" label="조회 기간" presentation="toolbar" density="compact" tone="primary" name="period" error-messages="기간 오류" aria-describedby="toolbar-help" /></section>',
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const select = wrapper.get("select");
      const id = select.attributes("id");
      expect(document.querySelector(`label[for="${id}"]`)?.textContent).toBe("조회 기간");
      expect(select.attributes("aria-label")).toBe("조회 기간");
      expect(select.attributes("aria-describedby")).toBe(`toolbar-help ${id}-messages`);
      expect(select.attributes("aria-invalid")).toBe("true");
      await select.trigger("focus");
      await select.trigger("keydown", { key: "ArrowDown" });
      await select.trigger("keyup", { key: "ArrowDown" });
      await select.setValue("second");
      expect(selected.value).toBe("second");
      const field = wrapper.getComponent(ScSelect);
      expect(field.emitted("change")).toEqual([["second"]]);
      for (const event of ["focus", "keydown", "keyup"])
        expect(field.emitted(event)).toHaveLength(1);
      await select.setValue("blocked");
      expect(selected.value).toBe("second");
      expect((select.element as HTMLSelectElement).value).toBe("second");
      expect(field.emitted("change")).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
  });

  it("readonly toolbar는 외부 form 값을 제출하며 부모 갱신을 표시하고 disabled는 제외한다", async () => {
    const selected = ref("first");
    const disabled = ref(false);
    const wrapper = mount(
      {
        components: { ScSelect },
        setup: () => ({ options, selected, disabled }),
        template:
          '<section><form id="toolbar-form"></form><sc-select :model-value="selected" :disabled="disabled" :options="options" label="구분" presentation="toolbar" name="category" form="toolbar-form" readonly /></section>',
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const field = wrapper.getComponent(ScSelect);
      const select = field.get("select");
      const form = wrapper.get("form").element as HTMLFormElement;
      expect((select.element as HTMLSelectElement).disabled).toBe(true);
      expect(select.attributes("aria-readonly")).toBe("true");
      expect(new FormData(form).get("category")).toBe("first");
      await select.setValue("second");
      expect(field.emitted("change")).toBeUndefined();
      selected.value = "second";
      await nextTick();
      expect((select.element as HTMLSelectElement).value).toBe("second");
      expect(new FormData(form).get("category")).toBe("second");
      disabled.value = true;
      await nextTick();
      expect(new FormData(form).has("category")).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("toolbar clearable 선택은 null을 전달하고 compact TextArea도 입력·오류 계약을 유지한다", async () => {
    const wrapper = mount(
      {
        components: { ScSelect, ScTextArea },
        setup: () => ({ options }),
        template:
          '<section><sc-select :model-value="\'first\'" :options="options" label="구분" presentation="toolbar" clearable /><sc-text-area model-value="보존" label="설명" density="compact" error-messages="설명 오류" /></section>',
      },
      { attachTo: document.body, global: global() },
    );
    try {
      await wrapper.get("select").setValue("");
      expect(wrapper.getComponent(ScSelect).emitted("update:modelValue")).toEqual([[null]]);
      const area = wrapper.getComponent(ScTextArea);
      expect(area.classes()).toContain("v-input--density-compact");
      expect(area.get("textarea").attributes("aria-invalid")).toBe("true");
      await area.get("textarea").setValue("첫 줄\n둘째 줄");
      expect(area.emitted("update:modelValue")).toEqual([["첫 줄\n둘째 줄"]]);
    } finally {
      wrapper.unmount();
    }
  });

  it("TextArea는 다중 줄·native attrs·focus/blur/keyboard/input/change를 한 번씩 전달한다", async () => {
    const value = ref("");
    const focus = vi.fn();
    const blur = vi.fn();
    const wrapper = mount(
      {
        components: { ScTextArea },
        setup: () => ({ value, focus, blur }),
        template:
          '<sc-text-area v-model="value" label="설명" name="description" autocomplete="off" :rows="3" :max-length="200" :min-length="2" required @focus="focus" @blur="blur" />',
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const input = wrapper.get("textarea");
      (input.element as HTMLTextAreaElement).focus();
      await nextTick();
      await input.trigger("keydown", { key: "Enter" });
      await input.trigger("keyup", { key: "Enter" });
      await input.setValue("첫 줄\n둘째 줄");
      (input.element as HTMLTextAreaElement).blur();
      await nextTick();
      const field = wrapper.getComponent(ScTextArea);
      expect(value.value).toBe("첫 줄\n둘째 줄");
      expect(focus).toHaveBeenCalledTimes(1);
      expect(blur).toHaveBeenCalledTimes(1);
      for (const event of ["input", "change", "keydown", "keyup"])
        expect(field.emitted(event)).toHaveLength(1);
      expect(input.attributes()).toMatchObject({
        name: "description",
        autocomplete: "off",
        rows: "3",
        maxlength: "200",
        minlength: "2",
        "aria-required": "true",
      });
      expect((input.element as HTMLTextAreaElement).required).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
