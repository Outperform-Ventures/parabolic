import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("retained keyboard actions operate on actual issue selection, properties, tabs and drafts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    expect(
      (
        await page.request.post(`${url}/auth/setup`, {
          data: {
            name: "Shortcut QA",
            email: "shortcuts@example.test",
            password: "Shortcut-test-password",
            workspaceName: "Keyboard tests",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const team = initial.teams[0];
    const issues = [];
    for (const title of [
      "First keyboard issue",
      "Second keyboard issue",
      "Third keyboard issue",
    ])
      issues.push(
        await (
          await page.request.post(`${url}/api/v1/issues`, {
            data: { title, teamId: team.id, assigneeId: initial.user.id },
          })
        ).json(),
      );
    await page.goto(`${url}/team/${team.id}/all`);
    await expect(page.getByTestId("issue-row")).toHaveCount(3);
    await page.locator(".page-header h1").click();
    await page.keyboard.press("j");
    await expect(page.locator(".issue-row.focused")).toHaveCount(1);
    await page.keyboard.press("x");
    await expect(page.locator(".issue-row.selected")).toHaveCount(1);
    await page.keyboard.press("p");
    await expect(page.getByRole("dialog")).toContainText("Change Priority");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "High", exact: true })
      .click();
    const selectedId = await page
      .locator(".issue-row.selected")
      .getAttribute("data-issue-id");
    await expect
      .poll(
        async () =>
          (await state()).issues.find((issue: any) => issue.id === selectedId)
            .priority,
      )
      .toBe(2);
    await page.locator(".page-header h1").click();
    await page.keyboard.press("Meta+a");
    await expect(page.locator(".issue-row.selected")).toHaveCount(3);
    await page.keyboard.press("i");
    await expect
      .poll(async () =>
        (await state()).issues.every(
          (issue: any) => issue.assigneeId === initial.user.id,
        ),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".issue-row.selected")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/issues/${selectedId}$`));
    await page.locator(".page-header").click({ position: { x: 300, y: 20 } });
    await page.keyboard.press("Shift+r");
    await page
      .getByRole("dialog")
      .getByLabel("Issue title")
      .fill("Renamed by keyboard");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((issue: any) => issue.id === selectedId)
            .title,
      )
      .toBe("Renamed by keyboard");
    await page.locator(".page-header").click({ position: { x: 300, y: 20 } });
    await page.keyboard.press("m");
    await page.keyboard.press("b");
    await expect(page.getByRole("dialog")).toContainText("Add relation");
    await page
      .getByRole("dialog")
      .locator(".selection-list button")
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((issue: any) => issue.id === selectedId)
            .relations?.[0]?.type,
      )
      .toBe("blockedBy");
    await page
      .locator(".issue-article>.rich-editor .tiptap")
      .fill("Editor text");
    await page.keyboard.press("Meta+k");
    await expect(
      page.getByRole("textbox", { name: "Command menu", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.locator(".page-header").click({ position: { x: 300, y: 20 } });
    await page.keyboard.press("Meta+t");
    await expect(page.locator(".app-tab")).toHaveCount(2);
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(new RegExp(`/issues/${selectedId}$`));
    await page.keyboard.press("Meta+9");
    await expect(page).toHaveURL(/\/my-issues$/);
    await page.keyboard.press("Meta+w");
    await expect(page.locator(".app-tab")).toHaveCount(1);
    await page.keyboard.press("Meta+Shift+t");
    await expect(page.locator(".app-tab")).toHaveCount(2);
    await page.locator(".page-header h1").click();
    await page.keyboard.press("g");
    await page.keyboard.press("d");
    await expect(page).toHaveURL(/\/drafts$/);
    await expect(
      page.locator(".page-header strong").filter({ hasText: /^Drafts$/ }),
    ).toBeVisible();
    await page.keyboard.press("Meta+f");
    await expect(
      page.getByRole("textbox", { name: "Find in page", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Find in page", exact: true })
      .fill("draft");
    await page.getByRole("button", { name: "Close find" }).click();
    await page.keyboard.press("Meta+/");
    await page.getByLabel("Search shortcuts").fill("drafts");
    await expect(page.getByRole("dialog")).toContainText("G then D");
    await expect(page.getByRole("dialog")).toContainText("Drafts");
    await page.keyboard.press("Escape");
    await page.screenshot({ path: "artifacts/platform/keyboard-drafts.png" });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("embedded project issue lists target selected issues and workspace undo preserves editor history", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Embedded keyboard",
        email: "embedded-keyboard@example.test",
        password: "Embedded-keyboard-password",
      },
    });
    const state = async () =>
        await (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state();
    const project = await (
        await page.request.post(`${url}/api/v1/projects`, {
          data: {
            name: "Embedded issue project",
            teamIds: [initial.teams[0].id],
            priority: 3,
          },
        })
      ).json(),
      issue = await (
        await page.request.post(`${url}/api/v1/issues`, {
          data: {
            title: "Embedded selected issue",
            teamId: initial.teams[0].id,
            projectId: project.id,
            priority: 0,
          },
        })
      ).json();
    await page.goto(`${url}/project/${project.id}/issues`);
    await expect(page.getByTestId("issue-row")).toHaveCount(1);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press("j");
    await page.keyboard.press("x");
    await page.keyboard.press("p");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Urgent", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((item: any) => item.id === issue.id)
            .priority,
      )
      .toBe(1);
    expect(
      (await state()).projects.find((item: any) => item.id === project.id)
        .priority,
    ).toBe(3);
    const mod = await page.evaluate(() =>
      /Mac/.test(navigator.platform) ? "Meta" : "Control",
    );
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press(`${mod}+z`);
    await expect
      .poll(
        async () =>
          (await state()).issues.find((item: any) => item.id === issue.id)
            .priority,
      )
      .toBe(0);
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect
      .poll(
        async () =>
          (await state()).issues.find((item: any) => item.id === issue.id)
            .priority,
      )
      .toBe(1);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/issues/${issue.id}$`));
    const editor = page.locator(".issue-article>.rich-editor .tiptap");
    await editor.click();
    await editor.pressSequentially("Editor history stays local");
    await expect
      .poll(
        async () =>
          (await state()).issues.find((item: any) => item.id === issue.id)
            .description,
      )
      .toContain("Editor history stays local");
    await page.keyboard.press(`${mod}+z`);
    await expect(editor).not.toContainText("Editor history stays local");
    expect(
      (await state()).issues.find((item: any) => item.id === issue.id).priority,
    ).toBe(1);
  } finally {
    await page.close();
    await app.close();
  }
});
