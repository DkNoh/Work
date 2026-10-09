import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { http, HttpResponse } from "msw";
import { expect, within } from "storybook/test";
import ConnectedExamplesStory from "./fixtures/ConnectedExamplesStory.vue";

const meta = {
  title: "조립 예제/모의 조회",
  component: ConnectedExamplesStory,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/examples", () =>
          HttpResponse.json({
            items: [{ id: 1, title: "Storybook 합성 예제", revision: 1 }],
            total: 1,
            page: 0,
            size: 20,
          }),
        ),
      ],
    },
    docs: {
      description: {
        component:
          "MSW 합성 자료와 story별 runtime으로 조회 상태를 재현한다. 실제 계정·DB·업무 API에 연결하지 않는다.",
      },
    },
  },
} satisfies Meta<typeof ConnectedExamplesStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Storybook 합성 예제")).toBeVisible();
  },
};
export const RequestError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/examples", () =>
          HttpResponse.json(
            { code: "MOCK_ERROR", message: "모의 조회 오류입니다." },
            { status: 500 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("alert")).toHaveTextContent(
      "모의 조회 오류입니다.",
    );
  },
};
