import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import ScControlStandardsStory from "./fixtures/ScControlStandardsStory.vue";

const meta = {
  title: "디자인 기반/공통 디자인 규격",
  component: ScControlStandardsStory,
  parameters: {
    docs: {
      description: {
        component:
          "같은 Sc 컴포넌트의 size·intent·variant·density·surface·tone을 조립한 기준 화면이다. Reference·Starter·생성 템플릿이 같은 공개 API를 소비한다. CSS를 복사하지 않고 props와 slot으로 화면을 구성한다.",
      },
    },
  },
} satisfies Meta<typeof ScControlStandardsStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standards: Story = {
  name: "버튼·입력·카드·배지 조립",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const small = canvas.getByRole("button", { name: "작은 버튼" });
    const medium = canvas.getByRole("button", { name: "기본 버튼" });
    const large = canvas.getByRole("button", { name: "큰 버튼" });
    await expect(small.getBoundingClientRect().height).toBeLessThan(
      medium.getBoundingClientRect().height,
    );
    await expect(medium.getBoundingClientRect().height).toBeLessThan(
      large.getBoundingClientRect().height,
    );
    const result = canvas.getByRole("status", { name: "디자인 예제 실행 횟수" });
    small.focus();
    await userEvent.keyboard("{Enter}");
    await expect(result).toHaveTextContent("실행 1회");
    await userEvent.click(canvas.getByRole("button", { name: "공통 디자인 새로 조회" }));
    await expect(result).toHaveTextContent("실행 2회");
    await expect(canvas.getByRole("button", { name: "비활성 버튼" })).toBeDisabled();
    const busy = canvas.getByRole("button", { name: "저장 중…" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    (busy as HTMLButtonElement).click();
    await expect(result).toHaveTextContent("실행 2회");
    const defaultField = canvas.getByRole("textbox", { name: "기본 제목" }).closest(".v-field")!;
    const compact = canvas.getByRole("textbox", { name: "간결한 제목" });
    await expect(compact.closest(".v-field")!.getBoundingClientRect().height).toBeLessThan(
      defaultField.getBoundingClientRect().height,
    );
    await userEvent.type(compact, "같은 입력 계약");
    await expect(compact).toHaveValue("같은 입력 계약");
    const toolbar = canvas.getByRole("combobox", { name: "조회 기간" });
    await userEvent.selectOptions(toolbar, "quarter");
    await expect(canvas.getByRole("status", { name: "선택 기간" })).toHaveTextContent("quarter");
    const defaultBody = canvas
      .getByRole("region", { name: "기본 입력과 카드" })
      .querySelector(".sc-section-card__body")!;
    const compactBody = canvas
      .getByRole("region", { name: "간결한 입력과 카드" })
      .querySelector(".sc-section-card__body")!;
    await expect(parseFloat(getComputedStyle(compactBody).paddingLeft)).toBeLessThan(
      parseFloat(getComputedStyle(defaultBody).paddingLeft),
    );
    await expect(canvas.getByText("처리 실패", { exact: true })).toBeVisible();
  },
};
