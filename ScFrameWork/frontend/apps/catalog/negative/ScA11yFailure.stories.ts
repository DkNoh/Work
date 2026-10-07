import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, within } from "storybook/test";

const meta = {
  title: "접근성 실패 게이트",
  render: () => ({
    // play는 통과하고 addon-a11y의 실제 afterEach가 이름 없는 버튼을 거절해야 한다.
    template: `
      <section class="sc-stack" aria-label="접근성 실패 게이트 예제">
        <h1>접근성 실패 게이트</h1>
        <button
          type="button"
          data-sc-a11y-negative="unnamed-button"
          style="width:48px;min-height:48px;border:1px solid var(--sc-color-control-border);background:var(--sc-color-surface);color:var(--sc-color-text)"
        ><span aria-hidden="true">!</span></button>
      </section>
    `,
  }),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnnamedVisibleButton: Story = {
  name: "이름 없는 버튼",
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName("");
  },
};
