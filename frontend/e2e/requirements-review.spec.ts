import { expect, test, type Page, type Route } from "@playwright/test";
import type { components } from "../apps/reference-app/src/generated/api";
import {
  choose,
  command,
  confirmDiscard,
  create,
  detail,
  fixtures,
  input,
  switchActor,
  type Requirement,
} from "./support/requirements";

const reviewForm = (page: Page) => page.getByRole("form", { name: "담당자 검토", exact: true });
const reviewRegion = (page: Page) => page.getByRole("region", { name: "담당자 검토", exact: true });
const bodyForm = (page: Page) => page.getByRole("form", { name: "요구사항 본문", exact: true });
const bodyRegion = (page: Page) => page.getByRole("region", { name: "요구사항 본문", exact: true });
const commentForm = (page: Page) => page.getByRole("form", { name: "댓글 작성", exact: true });

function reviewInput(revision: number, rationale: string): components["schemas"]["ReviewInput"] {
  return {
    revision,
    decision: "CONDITIONAL",
    rationale,
    conditions: "기존 API를 사용합니다.",
    scope: "목록 조회",
    exclusions: "외부 연동",
    acceptance: "조회 검증 통과",
    estimate: "MEDIUM",
    needsInfo: false,
  };
}

async function prepareReview(page: Page, title: string) {
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  const draft = await create(page, fixture.menu, title);
  const assigned = await command<Requirement>(page, `/requirements/${draft.id}/assignee`, "PUT", {
    revision: draft.revision,
    reviewerId: fixture.reviewer.user.id,
  });
  const requested = await command<Requirement>(page, `/requirements/${draft.id}/submit`, "POST", {
    revision: assigned.revision,
  });
  expect(requested.status).toBe("REQUESTED");
  await switchActor(page, fixture.reviewer.credentials);
  return requested;
}

async function fillReviewDraft(page: Page) {
  const form = reviewForm(page);
  await choose(page, form, "검토 결과", "가능");
  await choose(page, form, "규모", "소규모");
  await form.getByLabel("검토 근거", { exact: true }).fill("저장 전 검토 근거\n한국어 입력 보존");
  await form.getByLabel("조건", { exact: true }).fill("저장 전 조건");
  await form.getByLabel("반영 범위", { exact: true }).fill("저장 전 반영 범위");
  await form.getByLabel("제외 범위", { exact: true }).fill("저장 전 제외 범위");
  await form.getByLabel("완료 기준", { exact: true }).fill("저장 전 완료 기준");
  await form.getByLabel("추가 정보 요청", { exact: true }).check();
}

async function expectReviewDraft(page: Page, revision: number) {
  const form = reviewForm(page);
  await expect(form.getByLabel("검토 근거", { exact: true })).toHaveValue(
    "저장 전 검토 근거\n한국어 입력 보존",
  );
  for (const [label, value] of [
    ["조건", "저장 전 조건"],
    ["반영 범위", "저장 전 반영 범위"],
    ["제외 범위", "저장 전 제외 범위"],
    ["완료 기준", "저장 전 완료 기준"],
  ])
    await expect(form.getByLabel(label!, { exact: true })).toHaveValue(value!);
  await expect(form.getByLabel("추가 정보 요청", { exact: true })).toBeChecked();
  await expect(form.locator(".v-select__selection-text")).toHaveText(["가능", "소규모"]);
  await expect(
    reviewRegion(page).getByText(`입력 기준 revision ${revision}`, { exact: true }),
  ).toBeVisible();
}

test("담당자 검토의 실제 409·최신 GET 500·취소는 검토 초안과 revision을 보존하며 성공한 명시 조회만 교체한다", async ({
  page,
}) => {
  const item = await prepareReview(page, "검토 충돌에서 보존할 요구사항");
  await page.goto(`/requests/${item.id}`);
  await fillReviewDraft(page);
  const current = await command<Requirement>(
    page,
    `/requirements/${item.id}/review`,
    "PUT",
    reviewInput(item.revision, "서버에 저장된 최신 검토 근거"),
  );
  expect(current.revision).toBeGreaterThan(item.revision);
  const conflictResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/requirements/${item.id}/review` &&
      response.request().method() === "PUT",
  );
  await reviewForm(page).getByRole("button", { name: "검토 저장", exact: true }).click();
  const failedSave = await conflictResponse;
  expect(failedSave.status()).toBe(409);
  expect((await failedSave.json()).code).toBe("REVISION_CONFLICT");
  await expect(page.getByRole("status").filter({ hasText: "기준 revision을 유지" })).toBeVisible();
  await expectReviewDraft(page, item.revision);

  const comment = commentForm(page);
  await comment
    .getByLabel("댓글 내용", { exact: true })
    .fill("검토 충돌 후에도 등록할 수 있는 댓글");
  await comment.getByRole("button", { name: "댓글 등록", exact: true }).click();
  await expect(page.getByRole("list", { name: "댓글", exact: true })).toContainText(
    "검토 충돌 후에도 등록할 수 있는 댓글",
  );
  await expectReviewDraft(page, item.revision);
  await expect(page.getByRole("status").filter({ hasText: "기준 revision을 유지" })).toBeVisible();
  expect((await detail(page, item.id)).revision).toBe(current.revision);

  let latestGets = 0;
  const failLatestGet = async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    latestGets += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL", message: "합성 최신 검토 조회 실패", errors: [] }),
    });
  };
  await page.route(`**/api/requirements/${item.id}`, failLatestGet);
  const reload = page.getByRole("button", { name: "최신 내용 불러오기", exact: true });
  await reload.click();
  await page
    .getByRole("dialog", { name: "작성 중인 입력 확인", exact: true })
    .getByRole("button", { name: "취소", exact: true })
    .click();
  expect(latestGets).toBe(0);
  await expectReviewDraft(page, item.revision);
  await reload.click();
  await confirmDiscard(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "합성 최신 검토 조회 실패" }).first(),
  ).toBeVisible();
  expect(latestGets).toBe(1);
  await expectReviewDraft(page, item.revision);
  await expect(page.getByRole("status").filter({ hasText: "기준 revision을 유지" })).toBeVisible();
  expect((await detail(page, item.id)).review?.rationale).toBe(current.review?.rationale);

  await page.unroute(`**/api/requirements/${item.id}`, failLatestGet);
  await reload.click();
  await confirmDiscard(page);
  const form = reviewForm(page);
  await expect(form.getByLabel("검토 근거", { exact: true })).toHaveValue(
    current.review!.rationale,
  );
  await expect(form.getByLabel("추가 정보 요청", { exact: true })).not.toBeChecked();
  await expect(form.locator(".v-select__selection-text")).toHaveText(["조건부 가능", "중규모"]);
  await expect(
    reviewRegion(page).getByText(`입력 기준 revision ${current.revision}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  await form.getByLabel("검토 근거", { exact: true }).fill("최신 revision으로 저장한 검토");
  await form.getByRole("button", { name: "검토 저장", exact: true }).click();
  await expect
    .poll(async () => (await detail(page, item.id)).review?.rationale)
    .toBe("최신 revision으로 저장한 검토");
});

test("댓글 성공의 최신 상세 응답은 작성자의 작성 중인 본문과 입력 기준 revision을 덮지 않는다", async ({
  page,
}) => {
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  const item = await create(page, fixture.menu, "댓글 전에 저장된 요구사항 본문");
  await page.goto(`/requests/${item.id}`);
  const form = bodyForm(page);
  await form.getByLabel("요구사항 제목", { exact: true }).fill("댓글 등록 중에도 보존할 제목");
  await form.getByLabel("원하는 동작", { exact: true }).fill("아직 저장하지 않은 동작\n줄바꿈");
  const current = await command<Requirement>(
    page,
    `/requirements/${item.id}`,
    "PUT",
    input(fixture.menu.id, "서버의 별도 최신 제목", item.revision),
  );
  const comment = commentForm(page);
  await comment.getByLabel("댓글 내용", { exact: true }).fill("본문 입력 중 등록한 댓글");
  await comment.getByRole("button", { name: "댓글 등록", exact: true }).click();
  await expect(page.getByRole("list", { name: "댓글", exact: true })).toContainText(
    "본문 입력 중 등록한 댓글",
  );
  await expect(comment.getByLabel("댓글 내용", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("요구사항 제목", { exact: true })).toHaveValue(
    "댓글 등록 중에도 보존할 제목",
  );
  await expect(form.getByLabel("원하는 동작", { exact: true })).toHaveValue(
    "아직 저장하지 않은 동작\n줄바꿈",
  );
  await expect(
    bodyRegion(page).getByText(`입력 기준 revision ${item.revision}`, { exact: true }),
  ).toBeVisible();
  const saved = await detail(page, item.id);
  expect(saved.revision).toBe(current.revision);
  expect(saved.title).toBe(current.title);
  expect(saved.desired).toBe(current.desired);
  expect(saved.comments.at(-1)?.body).toBe("본문 입력 중 등록한 댓글");
});

test("댓글 성공의 최신 검토 응답은 담당자의 검토 초안·추가정보 선택과 입력 기준 revision을 덮지 않는다", async ({
  page,
}) => {
  const item = await prepareReview(page, "댓글과 검토 입력을 분리한 요구사항");
  await page.goto(`/requests/${item.id}`);
  await fillReviewDraft(page);
  const current = await command<Requirement>(
    page,
    `/requirements/${item.id}/review`,
    "PUT",
    reviewInput(item.revision, "서버에 별도로 저장한 검토"),
  );
  const comment = commentForm(page);
  await comment.getByLabel("댓글 내용", { exact: true }).fill("검토 입력 중 등록한 댓글");
  await comment.getByRole("button", { name: "댓글 등록", exact: true }).click();
  await expect(page.getByRole("list", { name: "댓글", exact: true })).toContainText(
    "검토 입력 중 등록한 댓글",
  );
  await expect(comment.getByLabel("댓글 내용", { exact: true })).toHaveValue("");
  await expectReviewDraft(page, item.revision);
  const saved = await detail(page, item.id);
  expect(saved.revision).toBe(current.revision);
  expect(saved.review).toEqual(current.review);
  expect(saved.comments.at(-1)?.body).toBe("검토 입력 중 등록한 댓글");
  // 댓글은 clean 처리되지만 검토 초안은 남아 있으므로 명시적인 조회에는 계속 확인이 필요하다.
  await page.getByRole("button", { name: "최신 내용 불러오기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "작성 중인 입력 확인", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expectReviewDraft(page, item.revision);
});
