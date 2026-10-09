import { describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createScI18n } from "@sc/i18n";
import { createScVuetify } from "@sc/ui";
import NoticeForm from "./NoticeForm.vue";
import type { NoticeResponse } from "./api";

const initial: NoticeResponse = {
  id: 1,
  title: "서버 제목",
  content: " 서버 본문\n ",
  authorId: 1,
  authorName: "작성자",
  authorUsername: "author",
  revision: 1,
  createdAt: "2026-10-07T00:00:00Z",
  updatedAt: "2026-10-07T00:00:00Z",
};
function setup() {
  const i18n = createScI18n();
  const wrapper = mount(NoticeForm, {
    props: { initial, resetKey: 1, busy: false, serverErrors: {} },
    global: { plugins: [i18n, createScVuetify()] },
  });
  return { wrapper, i18n };
}
describe("notice draft ownership", () => {
  it("keeps the draft through locale/source/error updates until explicit reset", async () => {
    const { wrapper, i18n } = setup();
    try {
      // 앱이 업무 메시지를 등록하지 않아도 실제 폼 이름을 제공해야 한다.
      expect(wrapper.get("form").attributes("aria-label")).toBe("공지 작성");
      expect(wrapper.text()).toContain("공지 본문");
      await wrapper.get("input").setValue("입력 제목");
      await wrapper.get("textarea").setValue("  편집 본문\n ");
      await flushPromises();
      await wrapper.setProps({
        initial: { ...initial, revision: 2, content: "새 서버 본문" },
        serverErrors: { content: "서버 필드 오류" },
      });
      i18n.global.locale.value = "en";
      await flushPromises();
      expect(wrapper.get("form").attributes("aria-label")).toBe("Notice form");
      expect(wrapper.text()).toContain("Notice content");
      expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("  편집 본문\n ");
      expect(wrapper.text()).toContain("서버 필드 오류");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.emitted("save")?.[0]).toEqual([
        { title: "입력 제목", content: "  편집 본문\n " },
      ]);
      await wrapper.setProps({ resetKey: 2 });
      await flushPromises();
      expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("새 서버 본문");
    } finally {
      wrapper.unmount();
    }
  });
  it("blocks synthetic submits while readonly or busy", async () => {
    const { wrapper } = setup();
    try {
      for (const props of [
        { readonly: true, busy: false },
        { readonly: false, busy: true },
      ]) {
        await wrapper.setProps(props);
        await wrapper.get("form").trigger("submit");
        await flushPromises();
      }
      expect(wrapper.emitted("save")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
