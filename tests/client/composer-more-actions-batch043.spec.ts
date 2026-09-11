import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("composer More actions matches the retained filter, inventory, due-date, and link contract", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", { data: { name: "Composer actions", email: "composer-actions@example.test", password: "composer-actions-password" } });
    await page.goto(url + "/my-issues");
    await page.getByRole("button", { name: "Create new issue", exact: true }).click();
    await page.getByRole("button", { name: "More actions", exact: true }).click();

    const filter = page.getByRole("searchbox", { name: "Filter issue actions", exact: true });
    await expect(filter).toBeFocused();
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Showing all items" })).toBeAttached();
    for (const label of ["Set due date", "Make recurring…", "Add link…", "Add customer request…", "Add sub-issue"])
      await expect(page.getByRole("menuitem").filter({ hasText: label })).toBeVisible();

    await filter.fill("link");
    await expect(page.getByRole("menuitem", { name: /^Add link…/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^Set due date/ })).toBeHidden();
    await filter.fill("");
    await page.getByRole("menuitem", { name: /^Set due date/ }).click();
    await expect(page.getByRole("menu", { name: "Set due date", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: /Tomorrow/ }).click();
    await expect(page.locator(".issue-composer .composer-properties time")).toHaveCount(1);

    await page.getByLabel("Issue title", { exact: true }).click();
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Add link…/ }).click();
    const linkDialog = page.getByRole("dialog", { name: "Edit link", exact: true });
    await expect(linkDialog).toBeVisible();
    await linkDialog.getByLabel("Link URL", { exact: true }).fill("https://example.com/evidence");
    await linkDialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator(".issue-composer .ProseMirror a")).toHaveAttribute("href", "https://example.com/evidence");
  } finally {
    await app.close();
  }
});

test("composer More actions continue into linked customer and child issue flows", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", { data: { name: "Composer followups", email: "composer-followups@example.test", password: "composer-followups-password" } });
    await page.goto(url + "/my-issues");
    await page.getByRole("button", { name: "Create new issue", exact: true }).click();
    await page.getByLabel("Issue title", { exact: true }).fill("Parent from actions");
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Add sub-issue/ }).click();
    await expect(page.getByLabel("Issue title", { exact: true })).toBeFocused();
    await expect(page.locator('.issue-composer [data-property="teamId"]')).toBeVisible();
    await page.getByLabel("Issue title", { exact: true }).fill("Child from actions");
    await page.getByRole("button", { name: "Create issue", exact: true }).click();
    await expect.poll(async () => {
      const issues = (await (await page.request.get(url + "/api/v1/issues")).json()).nodes;
      const parent = issues.find((issue: any) => issue.title === "Parent from actions");
      return issues.find((issue: any) => issue.title === "Child from actions")?.parentId === parent?.id;
    }).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator(".issue-composer")).toHaveCount(0);
    await page.getByRole("button", { name: "Create new issue", exact: true }).click();
    await page.getByLabel("Issue title", { exact: true }).fill("Customer-linked issue");
    await page.getByRole("button", { name: "More actions", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Add customer request…/ }).click();
    const requestDialog = page.getByRole("dialog", { name: "New customer request", exact: true });
    await expect(requestDialog).toBeVisible();
    await expect(requestDialog.getByLabel("Link to issue", { exact: true })).toHaveValue(/.+/);
  } finally {
    await app.close();
  }
});

test("dirty composer uses the retained discard confirmation and destructive focus", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", { data: { name: "Composer discard", email: "composer-discard@example.test", password: "composer-discard-password" } });
    await page.goto(url + "/my-issues");
    await page.getByRole("button", { name: "Create new issue", exact: true }).click();
    await page.getByLabel("Issue title", { exact: true }).fill("Discard me");
    await page.getByRole("button", { name: "Close composer", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Discard this issue?", exact: true });
    await expect(dialog).toContainText("Confirm that you want to discard this issue.");
    await expect(dialog.getByRole("button", { name: "Discard", exact: true })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue("Discard me");
  } finally {
    await app.close();
  }
});
