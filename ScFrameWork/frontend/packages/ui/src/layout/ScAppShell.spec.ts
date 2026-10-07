import { describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import ScAppShell from "./ScAppShell.vue";
import { createScVuetify } from "../theme";
import type { ScAppShellProps } from "./types";

const shellProps = {
  applicationTitle: "공통 프레임워크",
  navigationLabel: "업무 탐색",
  navigationItems: Object.freeze([
    Object.freeze({ id: "examples", label: "예제 목록", href: "/examples" }),
  ]),
  activeItem: "examples",
} satisfies ScAppShellProps;

describe("ScAppShell 공개 계약", () => {
  it("공개 slot을 정해진 영역에 조립하고 호출자의 id로 내부 본문 target을 덮지 않는다", () => {
    const wrapper = mount(ScAppShell, {
      props: shellProps,
      attrs: { id: "consumer-shell" },
      slots: {
        default: '<section aria-label="업무 화면"><h1>업무 내용</h1></section>',
        "header-leading": '<input aria-label="통합 검색" placeholder="검색" />',
        "header-actions": '<button type="button">계정 행동</button>',
        "sidebar-footer": "탐색 아래 설명",
        notice: '<p role="status">시스템 알림</p>',
      },
      global: { plugins: [createScVuetify()] },
    });
    try {
      expect(wrapper.get(".sc-app-shell").attributes("id")).toBe("consumer-shell");
      expect(wrapper.get("header button:last-child").text()).toBe("계정 행동");
      expect(wrapper.get(".sc-app-shell__header-leading input").attributes("aria-label")).toBe(
        "통합 검색",
      );
      expect(wrapper.get("aside").text()).toContain("탐색 아래 설명");
      expect(wrapper.get("main section").attributes("aria-label")).toBe("업무 화면");
      expect(wrapper.get("main [role='status']").text()).toBe("시스템 알림");
      const main = wrapper.get("main");
      expect(wrapper.findAll("main")).toHaveLength(1);
      expect(main.attributes("id")).not.toBe("consumer-shell");
      expect(wrapper.get(".sc-app-shell__skip").attributes("href")).toBe(
        `#${main.attributes("id")}`,
      );
      wrapper
        .get(".sc-app-shell__sidebar a")
        .element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(wrapper.emitted("navigate")?.[0]?.[0]).toBe(shellProps.navigationItems[0]);
    } finally {
      wrapper.unmount();
    }
  });

  it("데스크톱 접기·펼치기는 번역 문구와 aria 상태를 갱신하고 링크·본문·버튼 포커스를 유지한다", async () => {
    const media = {
      matches: true,
      media: "(min-width: 768px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } satisfies MediaQueryList;
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const wrapper = mount(ScAppShell, {
      attachTo: document.body,
      props: {
        ...shellProps,
        labels: {
          collapseNavigation: "Collapse navigation",
          expandNavigation: "Expand navigation",
        },
      },
      global: { plugins: [createScVuetify()] },
    });
    try {
      await nextTick();
      const button = wrapper.get<HTMLButtonElement>(".sc-app-shell__menu-toggle");
      const link = wrapper.get(".sc-app-shell__sidebar a");
      const main = wrapper.get("main");
      expect(button.attributes("aria-label")).toBe("Collapse navigation");
      expect(button.attributes("aria-expanded")).toBe("true");
      expect(button.attributes("aria-haspopup")).toBeUndefined();
      expect(button.attributes("aria-controls")).toBe(wrapper.get("aside").attributes("id"));
      button.element.focus();
      await button.trigger("click");
      expect(wrapper.get(".sc-app-shell").classes()).toContain("sc-app-shell--collapsed");
      expect(button.attributes("aria-label")).toBe("Expand navigation");
      expect(button.attributes("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(button.element);
      expect(wrapper.get(".sc-app-shell__sidebar a").element).toBe(link.element);
      expect(link.attributes("aria-current")).toBe("page");
      expect(link.get(".sc-shell-navigation__text").text()).toBe("예제 목록");
      expect(wrapper.get("main").element).toBe(main.element);
      await button.trigger("click");
      expect(wrapper.get(".sc-app-shell").classes()).not.toContain("sc-app-shell--collapsed");
      expect(button.attributes("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(button.element);
    } finally {
      wrapper.unmount();
      expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      matchMedia.mockRestore();
    }
  });

  it("HTML·ARIA·data 속성을 실제 div에 전달하고 Vuetify props와 임의 속성을 차단한다", async () => {
    const label = ref("첫 번째 앱");
    const Host = defineComponent({
      components: { ScAppShell },
      setup: () => ({ label, shellProps }),
      template:
        '<sc-app-shell v-bind="shellProps" :aria-label="label" class="consumer-class" title="설명" lang="ko" translate="no" data-qa="shell" theme="dark" density="compact" fluid custom-flag="ignored" style="--consumer-size: 24rem" />',
    });
    const wrapper = mount(Host, { global: { plugins: [createScVuetify()] } });
    try {
      const shell = wrapper.get(".sc-app-shell");
      expect(shell.classes()).toContain("consumer-class");
      expect(shell.attributes("aria-label")).toBe("첫 번째 앱");
      expect(shell.attributes("data-qa")).toBe("shell");
      expect(shell.attributes("title")).toBe("설명");
      expect(shell.attributes("lang")).toBe("ko");
      expect(shell.attributes("translate")).toBe("no");
      expect((shell.element as HTMLElement).style.getPropertyValue("--consumer-size")).toBe(
        "24rem",
      );
      for (const name of ["theme", "density", "fluid", "custom-flag"]) {
        expect(shell.attributes(name)).toBeUndefined();
        expect(wrapper.get(".v-application").attributes(name)).toBeUndefined();
      }
      expect(wrapper.get(".v-application").classes()).toContain("v-theme--sc");
      label.value = "갱신한 앱 이름";
      await nextTick();
      expect(shell.attributes("aria-label")).toBe("갱신한 앱 이름");
    } finally {
      wrapper.unmount();
    }
  });

  it("native capture 이벤트로 취소한 탐색을 navigate로 실행하지 않는다", () => {
    const onClickCapture = vi.fn((event: MouseEvent) => event.preventDefault());
    const wrapper = mount(ScAppShell, {
      props: shellProps,
      attrs: { onClickCapture },
      global: { plugins: [createScVuetify()] },
    });
    try {
      const link = wrapper.get(".sc-app-shell__sidebar a");
      link.element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(onClickCapture).toHaveBeenCalledOnce();
      expect(wrapper.emitted("navigate")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
