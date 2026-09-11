import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("Focus groups retain reading position, respect urgency and wake snoozed rows and badges on time", async ({ page }) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(12_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, { data: { name: "Focus owner", email: "focus@example.test", password: "isolated-focus-password", workspaceName: "Focus workspace" } });
    const state = async () => (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const notice = async (title: string, type: string, issueFields: any = {}, fields: any = {}) => {
      const issue = await create("issues", { title, teamId: initial.teams[0].id, ...issueFields });
      return create("notifications", { userId: initial.user.id, actorId: initial.user.id, issueId: issue.id, title, type, ...fields });
    };
    const urgent = await notice("Urgent work first", "status", { priority: 1 });
    await notice("Completed urgency stays closed", "status", { priority: 1, statusId: initial.statuses.find((s: any) => s.type === "completed").id });
    await notice("Approaching deadline", "slaWarning");
    await notice("Mention needing a reply", "mentioned");
    await notice("Read earlier", "comments", {}, { readAt: new Date().toISOString() });
    const comment = await notice("Conversation remains in place", "comments");
    await notice("Second conversation", "comments");
    const scheduled = await notice("Returns without another event", "assigned", {}, { snoozedUntil: new Date(Date.now() + 4_000).toISOString() });
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, { data: { preferences: { inbox: { priorityEnabled: false, groupBy: "focus", badgeCount: "all" } } } });
    await page.goto(`${url}/inbox`);
    const headings = page.locator(".inbox-group-heading");
    await expect(headings.first()).toContainText("Urgent");
    await expect(headings.nth(1)).toContainText("SLAs");
    await expect(headings.last()).toContainText("Read");
    const row = page.locator(`[data-notification-id="${comment.id}"]`);
    const priorTop = (await row.boundingBox())!.y;
    await row.click();
    await expect.poll(async () => !!(await state()).notifications.find((n: any) => n.id === comment.id).readAt).toBe(true);
    await expect(row).not.toHaveClass(/unread/);
    expect(Math.abs((await row.boundingBox())!.y - priorTop)).toBeLessThan(1);
    await expect(page.locator(`[data-notification-id="${urgent.id}"]`)).toBeVisible();
    const snoozed = page.locator(`[data-notification-id="${scheduled.id}"]`);
    await expect(snoozed).toHaveCount(0);
    const badge = page.getByRole("link", { name: "Inbox", exact: true }).locator(".sidebar-count");
    await expect(badge).toHaveText("5");
    await expect(snoozed).toBeVisible({ timeout: 8_000 });
    await expect(badge).toHaveText("6");
    await page.getByRole("button", { name: "Display options", exact: true }).click();
    await page.getByLabel("Notification ordering", { exact: true }).selectOption("priority");
    await page.keyboard.press("Escape");
    await expect(headings.last()).toContainText("Read");
    await page.screenshot({ path: "artifacts/verification/inbox-focus.png" });
    await page.reload();
    await expect(headings.first()).toContainText("Urgent");
    await page.getByRole("button", { name: "Display options", exact: true }).click();
    await expect(page.getByLabel("Group unreads by", { exact: true })).toHaveValue("focus");
    await expect(page.getByLabel("Notification ordering", { exact: true })).toHaveValue("priority");
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
