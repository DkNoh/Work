import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ValidatedFormStory from "./fixtures/ValidatedFormStory.vue";
const csrf = http.get("/api/auth/csrf", () =>
  HttpResponse.json({ headerName: "X-CSRF-TOKEN", token: "storybook-synthetic-csrf" }),
);
const success = http.post("/api/story-form", async ({ request }) => {
  if (request.headers.get("X-CSRF-TOKEN") !== "storybook-synthetic-csrf")
    return HttpResponse.json({ code: "CSRF", message: "모의 CSRF 오류" }, { status: 403 });
  return HttpResponse.json(await request.json(), { status: 201 });
});
const meta = {
  title: "조립 예제/폼 검증과 오류",
  component: ValidatedFormStory,
  parameters: { msw: { handlers: [csrf, success] } },
} satisfies Meta<typeof ValidatedFormStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ClientValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "제목" }), "   ");
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "제목" })).toHaveAccessibleDescription(
        "제목을 입력해 주세요.",
      ),
    );
    await expect(canvas.getByRole("status", { name: "제출 횟수" })).toHaveTextContent("0");
  },
};
export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "제목" });
    await userEvent.type(input, "  저장된 한국어  ");
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByRole("status", { name: "저장 결과" })).toHaveTextContent(
      "저장한 제목: 저장된 한국어",
    );
    await expect(input).toHaveValue("");
  },
};
function failureStory(status: number, message: string, fieldError?: string): Story {
  return {
    parameters: {
      msw: {
        handlers: [
          csrf,
          http.post("/api/story-form", () =>
            HttpResponse.json(
              {
                code: `MOCK_${status}`,
                message,
                errors: fieldError ? [{ field: "title", message: fieldError }] : [],
              },
              { status },
            ),
          ),
        ],
      },
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const input = canvas.getByRole("textbox", { name: "제목" });
      await userEvent.type(input, "실패해도 남는 입력");
      await userEvent.click(canvas.getByRole("button", { name: "저장" }));
      await expect(await canvas.findByRole("alert", { name: "저장 오류" })).toHaveTextContent(
        message,
      );
      await expect(input).toHaveValue("실패해도 남는 입력");
      await expect(canvas.getByRole("button", { name: "저장" })).toBeEnabled();
      if (fieldError) {
        // 오류 메시지의 transition이 끝나 실제 input 설명에 연결된 뒤 확인한다.
        await waitFor(() => expect(input).toHaveAccessibleDescription(fieldError));
        await userEvent.click(input);
        await userEvent.type(input, " 수정");
        await userEvent.tab();
        await expect(input).toHaveValue("실패해도 남는 입력 수정");
        await expect(input).toHaveAccessibleDescription(fieldError);
        await expect(input).toHaveAttribute("aria-invalid", "true");
        await expect(canvas.getByRole("status", { name: "제출 횟수" })).toHaveTextContent("1");
      }
    },
  };
}
export const FieldError400: Story = failureStory(400, "모의 입력 오류", "서버 제목 검증 오류");
export const Session401: Story = failureStory(401, "모의 로그인 만료");
export const Permission403: Story = failureStory(403, "모의 저장 권한 없음");
export const Conflict409: Story = failureStory(409, "모의 revision 충돌");
export const ServerError500: Story = failureStory(500, "모의 서버 오류");
export const SlowSubmit: Story = {
  parameters: {
    msw: {
      handlers: [
        csrf,
        http.post("/api/story-form", async ({ request }) => {
          await delay(300);
          return HttpResponse.json(await request.json(), { status: 201 });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "제목" }), "한 번만 저장");
    await userEvent.dblClick(canvas.getByRole("button", { name: "저장" }));
    await expect(canvas.getByRole("button", { name: "저장 중…" })).toBeDisabled();
    await expect(await canvas.findByRole("status", { name: "저장 결과" })).toHaveTextContent(
      "한 번만 저장",
    );
    await expect(canvas.getByRole("status", { name: "제출 횟수" })).toHaveTextContent("1");
  },
};
