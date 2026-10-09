import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect, userEvent, within } from "storybook/test";
import DateFormatStory from "./fixtures/DateFormatStory.vue";
const meta = { title: "확장 모듈/날짜", component: DateFormatStory } satisfies Meta<
  typeof DateFormatStory
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RawPrecisionAndLocale: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status", { name: "달력 표시" })).toHaveTextContent(
      "2026년 10월 6일",
    );
    await expect(canvas.getByRole("status", { name: "시각 표시" })).toHaveTextContent(
      "2026-10-06 09:00:00 +09:00",
    );
    await userEvent.click(canvas.getByRole("button", { name: "날짜 한국어/English" }));
    await expect(canvas.getByRole("status", { name: "달력 표시" })).toHaveTextContent(
      "Oct 6, 2026",
    );
    await expect(canvas.getByRole("textbox", { name: "UTC 원문" })).toHaveValue(
      "2026-10-06T00:00:00.123456789Z",
    );
    await expect(canvas.getByRole("status", { name: "UTC 보존 원문" })).toHaveTextContent(
      "2026-10-06T00:00:00.123456789Z",
    );
  },
};
export const InvalidInputAndDst: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByRole("textbox", { name: "달력 날짜" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "달력 날짜" }), "1900-02-29");
    await expect(canvas.getByRole("status", { name: "달력 표시" })).toHaveTextContent(
      "유효하지 않은 날짜",
    );
    await userEvent.click(canvas.getByRole("button", { name: "DST 경계 보기" }));
    await expect(canvas.getByRole("status", { name: "시각 표시" })).toHaveTextContent(
      "2026-03-08 03:00:00 -04:00",
    );
    await userEvent.clear(canvas.getByRole("textbox", { name: "UTC 원문" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "UTC 원문" }), "2026-03-08T03:00:00");
    await expect(canvas.getByRole("status", { name: "시각 표시" })).toHaveTextContent(
      "유효하지 않은 날짜",
    );
    await expect(canvas.getByRole("textbox", { name: "UTC 원문" })).toHaveValue(
      "2026-03-08T03:00:00",
    );
  },
};
