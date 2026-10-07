import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { components } from "../apps/reference-app/src/generated/api";
import { command, csrf, fixtures, switchActor } from "./support/requirements";
import { assertAccessible } from "./support/accessibility";

type Notice = components["schemas"]["NoticeResponse"];
type Document = components["schemas"]["DocumentResponse"];
type DocumentSummary = components["schemas"]["DocumentSummary"];

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  return errors;
}
async function snapshot(page: Page, info: TestInfo, state: string) {
  await assertAccessible(page, info, state);
  const file = info.outputPath(`${state}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(state, { path: file, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function latest<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api${path}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<T>;
}
async function grant(page: Page, id: number) {
  await command(page, `/kanban/members/${id}`, "PUT", { allowed: true });
}
async function language(page: Page, locale: "ko" | "en") {
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

for (const width of [390, 1366]) {
  test(`notice plain text persistence, real 409, draft/locale and explicit delete at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const data = await fixtures(page);
    await grant(page, data.author.user.id);
    await switchActor(page, data.author.credentials);
    await page.goto("/notices/new");
    const form = page.getByRole("form", { name: "공지 작성", exact: true });
    const title = form.getByRole("textbox", { name: "제목", exact: true });
    const content = form.getByRole("textbox", { name: "공지 본문", exact: true });
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(content).toHaveAccessibleDescription("입력해 주세요.");
    await title.fill("  실제 공지  ");
    const plain = "  평문 첫 줄\n<p>HTML이 아닌 문자열</p>\n ";
    await content.fill(plain);
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).toHaveURL(/\/notices\/\d+$/);
    const id = Number(page.url().split("/").at(-1));
    const persisted = await latest<Notice>(page, `/kanban/notices/${id}`);
    expect(persisted.content).toBe(plain);
    expect(persisted.revision).toBe(1);
    await page.reload();
    await expect(content).toHaveValue(plain);
    await expect(title).toHaveValue("실제 공지");
    await snapshot(page, info, `notice-${width}-ko`);

    await content.fill("  충돌해도 남길 입력\n ");
    await language(page, "en");
    const englishForm = page.getByRole("form", { name: "Notice form", exact: true });
    const englishBody = englishForm.getByRole("textbox", { name: "Notice content", exact: true });
    await expect(englishBody).toHaveValue("  충돌해도 남길 입력\n ");
    await command<Notice>(page, `/kanban/notices/${id}`, "PUT", {
      title: "서버 변경",
      content: " 서버의 새 본문\n ",
      revision: 1,
    });
    await englishForm.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Your input is preserved" }),
    ).toBeVisible();
    await expect(englishBody).toHaveValue("  충돌해도 남길 입력\n ");
    await snapshot(page, info, `notice-${width}-en-conflict`);
    await page.getByRole("button", { name: "Create new", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm change", exact: true });
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/notices/${id}$`));
    await expect(englishBody).toHaveValue("  충돌해도 남길 입력\n ");
    await page.getByRole("button", { name: "Load latest content", exact: true }).click();
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(englishBody).toHaveValue(" 서버의 새 본문\n ");
    await expect(englishForm.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "서버 변경",
    );
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/notices$/);
    expect((await page.request.get(`/api/kanban/notices/${id}`)).status()).toBe(404);
    expect(errors).toEqual([]);
  });

  test(`document real JSON storage, rich draft/409, locale and privacy at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const data = await fixtures(page);
    await switchActor(page, data.author.credentials);
    await page.goto("/documents/new");
    const form = page.getByRole("form", { name: "문서 작성", exact: true });
    const title = form.getByRole("textbox", { name: "제목", exact: true });
    const editor = form.getByRole("textbox", { name: "문서 내용", exact: true });
    await title.fill("서식 문서");
    await editor.fill("서식 앞부분 ");
    await editor.press("End");
    await form.getByRole("button", { name: "굵게", exact: true }).click();
    await editor.pressSequentially("굵은 한글");
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).toHaveURL(/\/documents\/\d+$/);
    const id = Number(page.url().split("/").at(-1));
    const saved = await latest<Document>(page, `/documents/${id}`);
    expect(typeof saved.documentJson).toBe("string");
    const doc = JSON.parse(saved.documentJson) as {
      type: string;
      content: { content: { text: string; marks?: { type: string }[] }[] }[];
    };
    expect(doc.type).toBe("doc");
    expect(
      doc.content
        .flatMap((node) => node.content)
        .some(
          (node) =>
            node.text.includes("굵은 한글") && node.marks?.some((mark) => mark.type === "bold"),
        ),
    ).toBe(true);
    await page.reload();
    await expect(editor).toContainText("굵은 한글");
    await snapshot(page, info, `document-${width}-ko`);
    await editor.fill("직접 작성한 충돌 초안");
    await language(page, "en");
    const englishForm = page.getByRole("form", { name: "Document form", exact: true });
    const englishEditor = englishForm.getByRole("textbox", {
      name: "Document content",
      exact: true,
    });
    await expect(englishEditor).toHaveText("직접 작성한 충돌 초안");
    await command<Document>(page, `/documents/${id}`, "PUT", {
      title: "서버 문서",
      documentJson: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "서버의 다른 본문" }] }],
      }),
      revision: 1,
    });
    await englishForm.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Your input is preserved" }),
    ).toBeVisible();
    await expect(englishEditor).toHaveText("직접 작성한 충돌 초안");
    await snapshot(page, info, `document-${width}-en-conflict`);
    await page.getByRole("button", { name: "Load latest content", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm change", exact: true });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(englishEditor).toHaveText("직접 작성한 충돌 초안");
    await page.getByRole("button", { name: "Load latest content", exact: true }).click();
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(englishEditor).toHaveText("서버의 다른 본문");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/documents$/);
    expect((await page.request.get(`/api/documents/${id}`)).status()).toBe(404);
    expect(errors).toEqual([]);
  });
}

test("notice is readable but author-only; documents remain private even to ADMIN", async ({
  page,
}, info) => {
  const errors = observeErrors(page);
  const data = await fixtures(page);
  await grant(page, data.author.user.id);
  await grant(page, data.reviewer.user.id);
  await switchActor(page, data.author.credentials);
  const notice = await command<Notice>(page, "/kanban/notices", "POST", {
    title: "다른 작성자의 공지",
    content: "다른 사람이 읽는 공지",
  });
  const document = await command<Document>(page, "/documents", "POST", {
    title: "개인 문서",
    documentJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
  });
  await switchActor(page);
  await page.goto(`/notices/${notice.id}`);
  const form = page.getByRole("form", { name: "공지 작성", exact: true });
  await expect(form.getByRole("textbox", { name: "공지 본문", exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(form.getByRole("button", { name: "저장", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  await snapshot(page, info, "notice-author-readonly-admin");
  const token = await csrf(page);
  const denied = await page.request.put(`/api/kanban/notices/${notice.id}`, {
    data: { title: "관리자 수정 거절", content: "거절", revision: 1 },
    headers: { [token.headerName]: token.token },
  });
  expect(denied.status()).toBe(403);
  await page.goto(`/documents/${document.id}`);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("form", { name: "문서 작성", exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/documents/${document.id}`)).status()).toBe(403);
  expect(
    (await latest<DocumentSummary[]>(page, "/documents")).some((row) => row.id === document.id),
  ).toBe(false);
  await snapshot(page, info, "document-private-admin-denied");
  await command(page, `/kanban/members/${data.reviewer.user.id}`, "PUT", { allowed: false });
  await switchActor(page, data.reviewer.credentials);
  expect((await page.request.get(`/api/kanban/notices/${notice.id}`)).status()).toBe(403);
  expect(errors).toEqual([]);
});
