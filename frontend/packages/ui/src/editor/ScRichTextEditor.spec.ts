import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { EditorContent, type Editor } from "@tiptap/vue-3";
import ScRichTextEditor from "./ScRichTextEditor.vue";
import { createScVuetify } from "../theme";
import { fromEditorDocument } from "./document";
import type { ScRichTextDocument } from "./contracts";

const doc = (text: string): ScRichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const editorOf = (wrapper: ReturnType<typeof mount>) =>
  wrapper.getComponent(EditorContent).props("editor") as Editor;
describe("ScRichTextEditor 실제 editor 계약", () => {
  it("즉시 JSON emit·부모 교체 무반복·잘못된 부모 문서의 draft 보존·destroy를 확인한다", async () => {
    const original = Object.freeze(doc("처음 문서"));
    const wrapper = mount(ScRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original, label: "본문" },
      global: { plugins: [createScVuetify()] },
    });
    await nextTick();
    await flushPromises();
    const editor = editorOf(wrapper);
    const destroy = vi.spyOn(editor, "destroy");
    try {
      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "직접 편집", marks: [{ type: "bold" }] }],
          },
        ],
      });
      expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toMatchObject({
        content: [{ content: [{ text: "직접 편집", marks: [{ type: "bold" }] }] }],
      });
      expect(original.content[0]?.content?.[0]?.text).toBe("처음 문서");
      const count = wrapper.emitted("update:modelValue")?.length;
      await wrapper.setProps({ modelValue: doc("부모 교체") });
      expect(editor.getText()).toBe("부모 교체");
      expect(wrapper.emitted("update:modelValue")).toHaveLength(count!);
      const invalid = {
        type: "doc",
        content: [{ type: "image", attrs: { src: "x" } }],
      } as unknown as ScRichTextDocument;
      await wrapper.setProps({ modelValue: invalid });
      expect(editor.getText()).toBe("부모 교체");
      expect(wrapper.emitted("invalid-document")).toHaveLength(1);
      expect(fromEditorDocument(editor.getJSON())).toEqual(doc("부모 교체"));
    } finally {
      wrapper.unmount();
    }
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(editor.isDestroyed).toBe(true);
  });

  it.each(["readonly", "disabled"] as const)(
    "%s에서 편집과 tool action을 제한하고 부모 변경·오류/설명을 유지한다",
    async (state) => {
      const wrapper = mount(ScRichTextEditor, {
        attachTo: document.body,
        props: {
          modelValue: doc("보존 입력"),
          label: "본문",
          [state]: true,
          hint: "설명",
          errorMessages: ["첫 오류", "둘째 오류", ""],
        },
        global: { plugins: [createScVuetify()] },
      });
      await nextTick();
      await flushPromises();
      try {
        const editor = editorOf(wrapper);
        expect(editor.isEditable).toBe(false);
        const input = wrapper.get('[role="textbox"]');
        expect(input.attributes(`aria-${state}`)).toBe("true");
        expect(input.attributes("aria-invalid")).toBe("true");
        const ids = input.attributes("aria-describedby").split(" ");
        expect(ids.map((id) => document.getElementById(id)?.textContent).join(" ")).toContain(
          "둘째 오류",
        );
        if (state === "disabled")
          for (const button of wrapper.findAll("button"))
            expect(button.attributes("disabled")).toBeDefined();
        else expect(wrapper.find('[role="group"]').exists()).toBe(false);
        await wrapper.setProps({ modelValue: doc("새 부모 값") });
        expect(editor.getText()).toBe("새 부모 값");
        expect(wrapper.emitted("update:modelValue")).toBeUndefined();
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("외부 ARIA attrs만 바뀌어도 native editor의 label/description을 갱신한다", async () => {
    const attributes = ref({ "aria-describedby": "first-help", "aria-labelledby": "first-label" });
    const value = ref(doc("보존 내용"));
    const host = {
      components: { ScRichTextEditor },
      setup: () => ({ attributes, value }),
      template: '<sc-rich-text-editor v-bind="attributes" v-model="value" label="본문" />',
    };
    const wrapper = mount(host, {
      attachTo: document.body,
      global: { plugins: [createScVuetify()] },
    });
    try {
      await nextTick();
      await flushPromises();
      const input = wrapper.get('[role="textbox"]');
      expect(input.attributes("aria-describedby")).toBe("first-help");
      attributes.value = { "aria-describedby": "second-help", "aria-labelledby": "second-label" };
      await nextTick();
      expect(input.attributes("aria-describedby")).toBe("second-help");
      expect(input.attributes("aria-labelledby")).toContain("second-label");
      expect(input.text()).toBe("보존 내용");
      expect(wrapper.getComponent(ScRichTextEditor).emitted("update:modelValue")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
