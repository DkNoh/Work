import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ScShellNavigation from "./ScShellNavigation.vue";

const items = [
  { id: "examples", label: "예제 목록", href: "/examples" },
  { id: "settings", label: "환경 설정", href: "/settings" },
];
const readonlyItems = Object.freeze(items.map((item) => Object.freeze({ ...item })));

describe("ScAppShell 탐색 계약", () => {
  it("연속 메뉴 그룹과 장식 아이콘을 표시하며 읽기 전용 자료와 원본 항목을 보존한다", () => {
    const groupedItems = Object.freeze([
      Object.freeze({
        id: "overview",
        label: "업무 현황",
        href: "/overview",
        groupLabel: "주요 업무",
        iconPath: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
      }),
      Object.freeze({
        id: "requests",
        label: "요구사항",
        href: "/requests",
        groupLabel: "주요 업무",
      }),
      Object.freeze({ id: "admin", label: "사용자 관리", href: "/admin", groupLabel: "관리" }),
    ]);
    const wrapper = mount(ScShellNavigation, {
      props: { label: "화면 탐색", items: groupedItems, activeItem: "overview", collapsed: true },
    });
    try {
      expect(
        wrapper.findAll(".sc-shell-navigation__label").map((heading) => heading.text()),
      ).toEqual(["주요 업무", "관리"]);
      expect(wrapper.findAll("a").map((link) => link.attributes("href"))).toEqual([
        "/overview",
        "/requests",
        "/admin",
      ]);
      const overview = wrapper.get('a[href="/overview"]');
      expect(overview.get("svg").attributes("aria-hidden")).toBe("true");
      expect(overview.get("svg").attributes("focusable")).toBe("false");
      expect(overview.get(".sc-shell-navigation__text").text()).toBe("업무 현황");
      expect(overview.attributes("title")).toBe("업무 현황");
      expect(overview.attributes("aria-current")).toBe("page");
      overview.element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(wrapper.emitted("navigate")?.[0]?.[0]).toBe(groupedItems[0]);
      expect(groupedItems.map((item) => item.id)).toEqual(["overview", "requests", "admin"]);
    } finally {
      wrapper.unmount();
    }
  });

  it("URL 이동은 소비 앱에 전달하고 선택된 화면을 aria-current로 표시한다", () => {
    const wrapper = mount(ScShellNavigation, {
      props: { label: "레퍼런스 화면", items: readonlyItems, activeItem: "examples" },
    });
    try {
      expect(wrapper.get("nav").attributes("aria-label")).toBe("레퍼런스 화면");
      expect(wrapper.get('a[href="/examples"]').attributes("aria-current")).toBe("page");
      const link = wrapper.get('a[href="/settings"]');
      expect(link.attributes("aria-current")).toBeUndefined();
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      link.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(wrapper.emitted("navigate")).toEqual([[readonlyItems[1]]]);
    } finally {
      wrapper.unmount();
    }
  });

  it("보조 버튼·수식 키 클릭을 가로채지 않아 브라우저 기본 동작을 유지한다", () => {
    const wrapper = mount(ScShellNavigation, {
      props: { label: "레퍼런스 화면", items, activeItem: "examples" },
    });
    try {
      const link = wrapper.get('a[href="/settings"]').element;
      for (const modifiers of [
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { altKey: true },
        { button: 1 },
      ]) {
        const event = new MouseEvent("click", {
          ...modifiers,
          bubbles: true,
          cancelable: true,
        });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(wrapper.emitted("navigate")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });

  it("소비 앱에서 먼저 취소한 링크 동작을 Router 선택으로 재실행하지 않는다", () => {
    const wrapper = mount(ScShellNavigation, {
      props: { label: "레퍼런스 화면", items, activeItem: "examples" },
    });
    try {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      event.preventDefault();
      wrapper.get('a[href="/settings"]').element.dispatchEvent(event);
      expect(wrapper.emitted("navigate")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
