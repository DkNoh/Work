import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ScFormActions from "./ScFormActions.vue";
import { createScVuetify } from "../theme";

const global = () => ({ plugins: [createScVuetify()] });

describe("ScFormActions", () => {
  it("부모 form에 제출하고 취소는 제출 없이 한 번 emit한다", async () => {
    const wrapper = mount(
      {
        components: { ScFormActions },
        data: () => ({ submitted: 0, cancelled: 0 }),
        template:
          '<form @submit.prevent="submitted++"><input name="title" value="입력" /><sc-form-actions @cancel="cancelled++" /><output>{{ submitted }} / {{ cancelled }}</output></form>',
      },
      { attachTo: document.body, global: global() },
    );
    try {
      const buttons = wrapper.findAll("button");
      expect(buttons.map((button) => button.attributes("type"))).toEqual(["button", "submit"]);
      await buttons[0].trigger("click");
      expect(wrapper.get("output").text()).toBe("0 / 1");
      (buttons[1].element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();
      expect(wrapper.get("output").text()).toBe("1 / 1");
      expect(wrapper.findAll("form")).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
  });

  it("form 밖에서도 명시 ID의 부모 form을 제출하고 설명·추가 행동 slot을 배치한다", async () => {
    const wrapper = mount(
      {
        components: { ScFormActions },
        data: () => ({ submitted: 0 }),
        template: `<section>
        <form id="action-target" @submit.prevent="submitted++"></form>
        <sc-form-actions form="action-target" :show-cancel="false">
          <template #notice>미저장 입력 있음</template>
          <template #secondary><button type="button">미리보기</button></template>
        </sc-form-actions>
        <output>{{ submitted }}</output>
      </section>`,
      },
      { attachTo: document.body, global: global() },
    );
    try {
      expect(wrapper.text()).toContain("미저장 입력 있음");
      expect(wrapper.get("button[type=submit]").attributes("form")).toBe("action-target");
      (wrapper.get("button[type=submit]").element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();
      expect(wrapper.get("output").text()).toBe("1");
      expect(wrapper.findAll("form")).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
  });

  it.each(["busy", "disabled"] as const)(
    "%s에서 기본 제출·취소를 막고 내부 옵션 attrs를 차단한다",
    (state) => {
      const wrapper = mount(ScFormActions, {
        props: { [state]: true },
        attrs: {
          "data-actions": "example",
          "aria-busy": false,
          loading: false,
          theme: "other",
          tag: "form",
        },
        global: global(),
      });
      try {
        for (const button of wrapper.findAll("button")) {
          expect((button.element as HTMLButtonElement).disabled).toBe(true);
          (button.element as HTMLButtonElement).click();
        }
        expect(wrapper.emitted("cancel")).toBeUndefined();
        expect(wrapper.element.tagName).toBe("DIV");
        expect(wrapper.attributes("data-actions")).toBe("example");
        expect(wrapper.attributes("loading")).toBeUndefined();
        expect(wrapper.attributes("theme")).toBeUndefined();
        expect(wrapper.attributes("aria-busy")).toBe(state === "busy" ? "true" : undefined);
      } finally {
        wrapper.unmount();
      }
    },
  );
});
