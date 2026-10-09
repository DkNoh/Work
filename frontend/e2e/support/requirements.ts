import { expect, type Locator, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { components } from "../../apps/reference-app/src/generated/api";

export type Requirement = components["schemas"]["RequirementDetail"];
export type User = components["schemas"]["UserResponse"];
export type Menu = components["schemas"]["MenuResponse"];
export type Credentials = { username: string; password: string };
type Csrf = { headerName: string; token: string };

export async function csrf(page: Page): Promise<Csrf> {
  const response = await page.request.get("/api/auth/csrf");
  expect(response.status()).toBe(200);
  return response.json() as Promise<Csrf>;
}

export async function command<T>(page: Page, path: string, method: "POST" | "PUT", data: unknown) {
  const token = await csrf(page);
  const response = await page.request.fetch(`/api${path}`, {
    method,
    data,
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<T>;
}

export async function login(page: Page, actor?: Credentials) {
  const token = await csrf(page);
  // page.request는 화면과 같은 쿠키를 사용한다. 합성 암호는 UI·trace·로그에 기록하지 않는다.
  if (!actor) {
    const metadata = JSON.parse(
      await fs.readFile(new URL("../../../.runtime/e2e.json", import.meta.url), "utf8"),
    ) as { passwordFile: string };
    actor = { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") };
  }
  const response = await page.request.post("/api/auth/login", {
    form: actor,
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(204);
}

export async function switchActor(page: Page, actor?: Credentials) {
  const token = await csrf(page);
  const response = await page.request.post("/api/auth/logout", {
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(204);
  await login(page, actor);
}

export async function fixtures(page: Page) {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const password = `Sc-${randomUUID()}`;
  const createUser = async (name: string, role: User["role"]) => {
    const credentials = { username: `${name}${suffix}`, password };
    const user = await command<User>(page, "/users", "POST", {
      ...credentials,
      displayName: `${name} 담당 ${suffix}`,
      role,
    });
    return { user, credentials };
  };
  const author = await createUser("author", "REQUESTER");
  const reviewer = await createUser("reviewer", "REVIEWER");
  const outsider = await createUser("other", "REQUESTER");
  const menu = await command<Menu>(page, "/menus", "POST", {
    parentId: null,
    name: `업무 메뉴 ${suffix}`,
    sortOrder: 0,
  });
  return { author, reviewer, outsider, menu };
}

export function input(menuId: number, title: string, revision = 1) {
  return {
    menuId,
    title,
    desired: "조회 결과를 확인합니다.\n한국어 줄바꿈을 보존합니다.",
    reason: "반복 업무를 줄입니다.",
    referenceText: "",
    similar: false,
    followParts: "",
    revision,
    screenVersionId: null,
    annotation: null,
  };
}

export async function create(page: Page, menu: Menu, title: string) {
  return command<Requirement>(page, "/requirements", "POST", input(menu.id, title));
}

export async function detail(page: Page, id: number): Promise<Requirement> {
  const response = await page.request.get(`/api/requirements/${id}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<Requirement>;
}

export async function choose(page: Page, form: Locator, label: string, option: string) {
  // wrapper/input 역할을 구분하여 실제 입력의 접근성 이름과 실제 listbox를 사용한다.
  const control = form.locator("input[role='combobox']").filter({ visible: true });
  const target = control.and(form.getByLabel(label, { exact: true }));
  await expect(target).toHaveAccessibleName(label);
  // Vuetify의 표시 영역은 입력 위에 놓인다. 실제 입력 포커스와 Enter로 선택 목록을 연다.
  await target.focus();
  await target.press("Enter");
  // 가상 목록과 한국어 이름도 실제 Home/ArrowDown/Enter로 선택한다. 한글 keypress는 지원되지 않는다.
  const list = page.getByRole("listbox", { name: label, exact: true });
  await expect(target).toHaveAttribute("aria-expanded", "true");
  await expect(list).toBeVisible();
  await expect(list.getByRole("option").first()).toBeVisible();
  // VSelect는 transition 후 listRef와 선택 중 option의 focus를 확정한다.
  // 실제 목록 mount·유한 animation 완료를 기다려 Home이 빈 listRef에 전달되지 않게 한다.
  await list.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const focused = list.locator("[role='option']:focus");
  await target.press("Home");
  await expect(focused).toHaveCount(1);
  const count = Number(await focused.getAttribute("aria-setsize"));
  expect(Number.isSafeInteger(count) && count > 0).toBe(true);
  for (let index = 0; index < count; index++) {
    if (
      (await list.getByRole("option", { name: option, exact: true }).and(focused).count()) === 1
    ) {
      await page.keyboard.press("Enter");
      await expect(list).toHaveCount(0);
      return;
    }
    if (index + 1 === count) break;
    const position = await focused.getAttribute("aria-posinset");
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(async () =>
        (await focused.count()) === 1 ? focused.getAttribute("aria-posinset") : position,
      )
      .not.toBe(position);
  }
  throw new Error(`선택 목록에 '${option}' 옵션이 없습니다.`);
}

export async function confirmDiscard(page: Page) {
  const dialog = page.getByRole("dialog", { name: "작성 중인 입력 확인", exact: true });
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "계속 진행", exact: true }).click();
}
