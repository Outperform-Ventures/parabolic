import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("selection converts immediately while pasted titles and comments retain the composer", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Selection owner",
        email: "selection-owner@example.test",
        password: "Selection-owner-password",
      },
    });
    const state = async () =>
        await (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state();
    const issue = await (
        await page.request.post(`${url}/api/v1/issues`, {
          data: {
            title: "Break down selected work",
            teamId: initial.teams[0].id,
            priority: 2,
            description:
              "<ul><li><p>Prepare first deliverable</p></li><li><p>Review second deliverable</p></li></ul>",
          },
        })
      ).json(),
      comment = await (
        await page.request.post(`${url}/api/v1/comments`, {
          data: {
            issueId: issue.id,
            body: "<p>Follow up on customer feedback</p>",
          },
        })
      ).json();
    await page.goto(`${url}/issues/${issue.id}`);
    const editor = page.locator(".issue-article>.rich-editor .tiptap");
    await expect(editor).toContainText("Review second deliverable");
    const mod = await page.evaluate(() =>
      /Mac/.test(navigator.platform) ? "Meta" : "Control",
    );
    const select = () =>
      editor.evaluate((element) => {
        (element as HTMLElement).focus();
        const range = document.createRange();
        range.selectNodeContents(element.querySelector("ul")!);
        const selection = getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await select();
    await page.keyboard.press(`${mod}+Shift+o`);
    const composer = page.locator(".issue-composer");
    await expect(composer).toHaveCount(0);
    const children = async () =>
      (await state()).issues.filter(
        (item: any) => item.parentId === issue.id && !item.deletedAt,
      );
    await expect.poll(async () => (await children()).length).toBe(2);
    expect((await children()).every((item: any) => item.priority === 2)).toBe(
      true,
    );
    await page.keyboard.press(`${mod}+Alt+o`);
    await expect(composer).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/issues/${issue.id}$`));
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(async () => (await children()).length).toBe(0);
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect.poll(async () => (await children()).length).toBe(2);
    await expect(editor.locator('a[href*="/issues/"]')).toHaveCount(2);
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(async () => (await children()).length).toBe(0);
    await expect(editor.locator("li")).toHaveCount(2);
    await select();
    await page
      .getByRole("button", {
        name: "Create sub-issues from selection",
        exact: true,
      })
      .click();
    await expect(composer).toHaveCount(0);
    await expect.poll(async () => (await children()).length).toBe(2);
    await expect(editor.locator('a[href*="/issues/"]')).toHaveCount(2);
    await page
      .locator(`#comment-${comment.id}`)
      .getByRole("button", { name: "Comment options" })
      .click();
    await page
      .getByRole("menuitem", {
        name: "New sub-issue from comment…",
        exact: true,
      })
      .click();
    await expect(
      composer.getByLabel("Issue title", { exact: true }),
    ).toHaveValue("Follow up on customer feedback");
    await composer
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect.poll(async () => (await children()).length).toBe(3);
    await page.keyboard.press("Escape");
    await expect(composer).toHaveCount(0);
    await page
      .getByRole("button", { name: "Create new sub-issue", exact: true })
      .click();
    await composer
      .getByLabel("Issue title", { exact: true })
      .evaluate((element) => {
        const clipboard = new DataTransfer();
        clipboard.setData(
          "text/plain",
          "- [ ] Pasted checklist title\n2. Pasted numbered title",
        );
        const event = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "clipboardData", { value: clipboard });
        element.dispatchEvent(event);
      });
    await expect(
      composer.getByLabel("Issue titles", { exact: true }),
    ).toHaveValue("Pasted checklist title\nPasted numbered title");
    await composer
      .getByRole("button", { name: "Create 2 issues", exact: true })
      .click();
    await expect.poll(async () => (await children()).length).toBe(5);
    await page.keyboard.press("Escape");
    await expect(composer).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});
