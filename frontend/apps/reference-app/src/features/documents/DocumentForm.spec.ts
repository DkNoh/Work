import { describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { EditorContent, type Editor } from "@tiptap/vue-3";
import { createScI18n } from "@sc/i18n";
import { createScVuetify } from "@sc/ui";
import DocumentForm from "./DocumentForm.vue";
import { documentMessages } from "./messages";
import type { DocumentResponse } from "./api";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const initial: DocumentResponse = {
  id: 1,
  title: "서버 문서",
  documentJson: JSON.stringify(doc("서버 내용")),
  authorId: 1,
  authorName: "작성자",
  revision: 1,
  createdAt: "2026-10-07T00:00:00Z",
  updatedAt: "2026-10-07T00:00:00Z",
};
function setup() {
  const i18n = createScI18n();
  const wrapper = mount(DocumentForm, {
    attachTo: document.body,
    props: { initial, resetKey: 1, busy: false, serverErrors: {} },
    global: { plugins: [i18n, createScVuetify()] },
  });
  return { wrapper, i18n };
}
describe("document draft ownership", () => {
  it("preserves editor JSON through source/locale/error changes until explicit reset", async () => {
    const { wrapper, i18n } = setup();
    try {
      await flushPromises();
      // global fixture가 빠진 업무 메시지를 대신 등록해 결함을 가리지 않는다.
      expect(wrapper.get("form").attributes("aria-label")).toBe("문서 작성");
      expect(wrapper.get(".sc-rich-text-editor__label").text()).toBe("문서 내용");
      const editor = wrapper.getComponent(EditorContent).props("editor") as Editor;
      editor.commands.setContent(doc(" 입력 중 한글 "));
      await wrapper.get("input").setValue("입력 제목");
      await flushPromises();
      await wrapper.setProps({
        initial: { ...initial, revision: 2, documentJson: JSON.stringify(doc("새 서버 내용")) },
        serverErrors: { documentJson: "서버 문서 오류" },
      });
      i18n.global.locale.value = "en";
      await flushPromises();
      expect(wrapper.get("form").attributes("aria-label")).toBe("Document form");
      expect(wrapper.get(".sc-rich-text-editor__label").text()).toBe("Document content");
      expect(editor.getText()).toBe(" 입력 중 한글 ");
      expect(wrapper.text()).toContain("서버 문서 오류");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.emitted("save")?.[0]).toEqual([
        { title: "입력 제목", document: doc(" 입력 중 한글 ") },
      ]);
      await wrapper.setProps({ resetKey: 2 });
      await flushPromises();
      expect(editor.getText()).toBe("새 서버 내용");
    } finally {
      wrapper.unmount();
    }
  });
  it("blocks malformed stored JSON rather than saving a blank replacement", async () => {
    const { wrapper } = setup();
    try {
      await wrapper.setProps({
        initial: { ...initial, documentJson: "<p>invalid</p>" },
        resetKey: 2,
      });
      await flushPromises();
      expect(wrapper.text()).toContain(documentMessages.ko.grammar);
      expect((wrapper.getComponent(EditorContent).props("editor") as Editor).isEditable).toBe(
        false,
      );
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.emitted("save")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
