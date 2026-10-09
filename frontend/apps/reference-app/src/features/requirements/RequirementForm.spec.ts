import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createScI18n } from "@sc/i18n";
import { createScVuetify, ScTextField } from "@sc/ui";
import RequirementForm from "./RequirementForm.vue";
import { requirementMessages } from "./messages";
import type { RequirementDetail } from "./api";

const initial: RequirementDetail = {
  id: 1,
  title: "서버 제목",
  menuId: 1,
  menuName: "메뉴",
  desired: "동작",
  reason: "이유",
  referenceText: "",
  similar: 0,
  followParts: "",
  screenVersionId: null,
  status: "DRAFT",
  revision: 1,
  authorId: 1,
  authorName: "작성자",
  assignedReviewerId: null,
  assignedReviewerName: null,
  createdAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-06T00:00:00Z",
  review: null,
  annotation: null,
  screenVersion: null,
  comments: [],
  history: [],
  attachments: [],
  ado: null,
};
function setup() {
  const i18n = createScI18n({
    messages: { ko: { request: requirementMessages.ko }, en: { request: requirementMessages.en } },
  });
  const wrapper = mount(RequirementForm, {
    props: {
      initial,
      resetKey: 1,
      menus: [{ id: 1, parentId: null, name: "메뉴", sortOrder: 0, active: 1 }],
      busy: false,
      readonly: false,
      serverErrors: {},
    },
    global: { plugins: [i18n, createScVuetify()] },
  });
  return { wrapper, i18n };
}
describe("requirement input ownership", () => {
  it("preserves input through server-source and locale updates, then replaces it only at an explicit reset", async () => {
    const { wrapper, i18n } = setup();
    try {
      const title = wrapper.findComponent(ScTextField).get("input");
      await title.setValue("저장 전 입력");
      await flushPromises();
      await wrapper.setProps({ initial: { ...initial, title: "다른 서버 제목", revision: 2 } });
      i18n.global.locale.value = "en";
      await flushPromises();
      expect((title.element as HTMLInputElement).value).toBe("저장 전 입력");
      expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([true]);
      await wrapper.setProps({ resetKey: 2 });
      await flushPromises();
      expect((title.element as HTMLInputElement).value).toBe("다른 서버 제목");
      expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([false]);
    } finally {
      wrapper.unmount();
    }
  });
  it("maps server field errors without resetting values and clears old field errors on a new valid submission", async () => {
    const { wrapper } = setup();
    try {
      const title = wrapper.findComponent(ScTextField).get("input");
      await title.setValue("  보존할 입력  ");
      await flushPromises();
      await wrapper.setProps({ serverErrors: { title: "서버 제목 오류" } });
      expect(wrapper.text()).toContain("서버 제목 오류");
      expect((title.element as HTMLInputElement).value).toBe("  보존할 입력  ");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.text()).not.toContain("서버 제목 오류");
      expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
        title: "  보존할 입력  ",
        menuId: "1",
      });
      expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([true]);
    } finally {
      wrapper.unmount();
    }
  });
});
