import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { useArgs } from "storybook/preview-api";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScAppShell, uiTokens, type ScAppShellNavItem } from "@sc/ui";
import ScAppShellStory from "./fixtures/ScAppShellStory.vue";

const meta = {
  title: "공통 배치/ScAppShell",
  component: ScAppShell,
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ScAppShellStory },
      setup: () => ({
        args,
        selectScreen: (item: ScAppShellNavItem) => updateArgs({ activeItem: item.id }),
      }),
      template: "<ScAppShellStory v-bind='args' @navigate='selectScreen' />",
    };
  },
  args: {
    applicationTitle: "ScFramework",
    applicationLabel: "중립 레퍼런스 화면",
    navigationLabel: "화면 탐색",
    navigationItems: [
      { id: "examples", label: "예제 업무", href: "#examples" },
      { id: "reports", label: "조회 보고서", href: "#reports" },
      { id: "settings", label: "설정", href: "#settings" },
    ],
    activeItem: "examples",
  },
  globals: { viewport: { value: "desktop1366", isRotated: false } },
  parameters: {
    scFrame: "shell",
    docs: {
      description: {
        component:
          "메뉴 자료·현재 항목은 앱이 전달하고 navigate 이벤트는 앱의 Router에 연결합니다. default/header-actions/sidebar-footer/notice slot으로 업무 화면을 조립합니다. 768px 미만의 native dialog는 Tab 범위·Escape·포커스 복귀를 제공하며 넓은 화면에서는 sidebar를 표시합니다. 메뉴를 숨기는 것으로 서버 권한 검사를 대체하지 않습니다.",
      },
    },
  },
} satisfies Meta<typeof ScAppShell>;
export default meta;
type Story = StoryObj<typeof meta>;
const longApplicationTitle = "전사 공통 업무 시스템과 프로젝트 관리 프레임워크";

export const Default: Story = {
  name: "공통 셸",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector(".v-card")!;
    await expect(getComputedStyle(card).borderRadius).toBe(`${uiTokens.radius.md}px`);
    const shadowSample = document.createElement("div");
    shadowSample.style.boxShadow = uiTokens.shadow.card;
    canvasElement.append(shadowSample);
    const expectedShadow = getComputedStyle(shadowSample).boxShadow;
    shadowSample.remove();
    await expect(getComputedStyle(card).boxShadow).toBe(expectedShadow);
    await expect(getComputedStyle(canvasElement.querySelector(".v-card-text")!).fontSize).toBe(
      `${uiTokens.fontSize.body}px`,
    );
    await expect(canvas.getByRole("link", { name: "예제 업무" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(canvas.getByRole("link", { name: "조회 보고서" }));
    await expect(canvas.getByRole("status", { name: "선택한 화면" })).toHaveTextContent(
      "조회 보고서",
    );
    await expect(canvas.getByRole("link", { name: "조회 보고서" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};
export const LongKorean: Story = {
  name: "긴 한국어 메뉴·제목",
  args: {
    applicationTitle: longApplicationTitle,
    navigationItems: [
      {
        id: "examples",
        label: "업무 요구사항과 검토 요청을 함께 관리하는 긴 메뉴 이름",
        href: "#examples",
      },
      { id: "reports", label: "월간 업무 조회와 상세 보고서", href: "#reports" },
    ],
  },
};
export const Keyboard: Story = {
  name: "키보드와 본문 이동",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const skipLink = canvas.getByRole("link", { name: "본문으로 이동" });
    await expect(skipLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("main")).toHaveFocus();
  },
};

export const MobileNavigation: Story = {
  name: "모바일 탐색·포커스 복귀",
  globals: { viewport: { value: "mobile390", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "탐색 메뉴 열기" });
    await userEvent.click(trigger);
    let dialog = await canvas.findByRole("dialog", { name: "화면 탐색" });
    const closeButton = within(dialog).getByRole("button", { name: "탐색 메뉴 닫기" });
    await expect(closeButton).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(within(dialog).getByRole("link", { name: "설정" })).toHaveFocus();
    await userEvent.tab();
    await expect(closeButton).toHaveFocus();
    await userEvent.tab();
    await expect(within(dialog).getByRole("link", { name: "예제 업무" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    dialog = await canvas.findByRole("dialog", { name: "화면 탐색" });
    await userEvent.click(within(dialog).getByRole("link", { name: "조회 보고서" }));
    await expect(canvas.getByRole("status", { name: "선택한 화면" })).toHaveTextContent(
      "조회 보고서",
    );
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expect(await canvas.findByRole("dialog", { name: "화면 탐색" })).toBeVisible();
  },
};
export const MobileLongKorean: Story = {
  ...LongKorean,
  name: "모바일 긴 한국어",
  globals: { viewport: { value: "mobile390", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    async function expectMeasuredHeight(expanded: boolean) {
      await waitFor(() => {
        const headerHeight = canvasElement
          .querySelector(".sc-app-shell__header")!
          .getBoundingClientRect().height;
        if (expanded) expect(headerHeight).toBeGreaterThan(uiTokens.layout.headerHeight);
        else expect(headerHeight).toBeCloseTo(uiTokens.layout.headerHeight);
        const shellStyle = getComputedStyle(canvasElement.querySelector(".sc-app-shell")!);
        expect(parseFloat(shellStyle.getPropertyValue("--sc-shell-header-height"))).toBeCloseTo(
          headerHeight,
        );
        expect(
          parseFloat(getComputedStyle(canvasElement.querySelector(".sc-app-shell__sidebar")!).top),
        ).toBeCloseTo(headerHeight);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      });
    }
    await expectMeasuredHeight(false);
    const trigger = canvas.getByRole("button", { name: "탐색 메뉴 열기" });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole("dialog", { name: "화면 탐색" });
    const title = within(dialog).getByText(longApplicationTitle, {
      selector: "strong",
      exact: true,
    });
    await expect(title).toBeVisible();
    await expect(title).toHaveTextContent(longApplicationTitle);
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
    expect(title.scrollHeight).toBeLessThanOrEqual(title.clientHeight + 1);
    await userEvent.click(within(dialog).getByRole("button", { name: "탐색 메뉴 닫기" }));
    await expect(trigger).toHaveFocus();
    await userEvent.click(canvas.getByRole("button", { name: "도구 영역 펼치기" }));
    await expect(canvas.getByRole("button", { name: "도구 영역 접기" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expectMeasuredHeight(true);
    await userEvent.click(canvas.getByRole("button", { name: "도구 영역 접기" }));
    await expect(canvas.getByRole("button", { name: "도구 영역 펼치기" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expectMeasuredHeight(false);
  },
};
