import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import ScI18nStory from "./fixtures/ScI18nStory.vue";
const meta = { title: "확장 모듈/다국어", component: ScI18nStory } satisfies Meta<
  typeof ScI18nStory
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KoreanAndEnglish: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "제목" }), "보존할 한국어 입력");
    await userEvent.click(canvas.getByRole("button", { name: "한국어/English" }));
    await expect(canvas.getByRole("textbox", { name: "Title" })).toHaveValue("보존할 한국어 입력");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(canvas.getByText("한국어 fallback 문구")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "한국어/English" }));
    await expect(canvas.getByRole("textbox", { name: "제목" })).toHaveValue("보존할 한국어 입력");
  },
};
