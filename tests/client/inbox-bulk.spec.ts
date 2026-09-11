import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

async function fixture(page: Page) {
  page.setDefaultTimeout(12_000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.request.post(`${url}/auth/setup`, {
    data: {
      name: "Bulk reader",
      email: "bulk@example.test",
      password: "isolated-bulk-password",
      workspaceName: "Bulk notification behavior",
    },
  });
  expect(response.ok()).toBeTruthy();
  const state = async () =>
    (await page.request.get(`${url}/api/v1/state`)).json();
  const initial = await state();
  const create = async (kind: string, data: any) => {
    const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const issue = (title: string, statusId?: string) =>
    create("issues", {
      title,
      teamId: initial.teams[0].id,
      ...(statusId ? { statusId } : {}),
    });
  const notice = (issueId: string, fields: any = {}) =>
    create("notifications", {
      userId: initial.user.id,
      issueId,
      type: "comments",
      title: "A conversation update",
      ...fields,
    });
  const prefs = await page.request.patch(
    `${url}/api/v1/users/${initial.user.id}`,
    {
      data: {
        preferences: { inbox: { priorityEnabled: false, ordering: "oldest" } },
      },
    },
  );
  expect(prefs.ok()).toBeTruthy();
  const deleted = async (ids: string[]) => {
    const data = await state();
    return ids.map(
      (id) => !!data.notifications.find((n: any) => n.id === id)?.deletedAt,
    );
  };
  const menu = async (name: string) => {
    await page.keyboard.down("Alt");
    await page
      .getByRole("button", { name: "Notification actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: name === "Delete all read" ? /^Delete all read/ : name, exact: name !== "Delete all read" }).click();
    await page.keyboard.up("Alt");
    await page
      .getByRole("button", { name: "Delete notifications", exact: true })
      .click();
  };
  return { app, url, state, initial, issue, notice, deleted, menu, errors };
}

test("bulk Inbox cleanup deletes raw eligible events without deleting unread or snoozed group members", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const f = await fixture(page);
  try {
    const active = await f.issue("Mixed read and unread activity");
    const closed = await f.issue(
      "Completed issue activity",
      f.initial.statuses.find((s: any) => s.type === "completed").id,
    );
    const readAt = new Date().toISOString();
    const activeRead = await f.notice(active.id, { readAt }),
      activeUnread = await f.notice(active.id);
    const closedRead = await f.notice(closed.id, { readAt }),
      closedUnread = await f.notice(closed.id);
    const sleepingRead = await f.notice(closed.id, {
      readAt,
      snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const ids = [
      activeRead.id,
      activeUnread.id,
      closedRead.id,
      closedUnread.id,
      sleepingRead.id,
    ];
    await page.goto(`${f.url}/inbox`);
    await expect(page.locator(".inbox-item")).toHaveCount(2);
    await f.menu("Delete all read");
    await expect
      .poll(() => f.deleted(ids))
      .toEqual([true, false, true, false, false]);
    await expect(page.locator(".inbox-item")).toHaveCount(2);
    await page.locator(".inbox-item").first().focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(() => f.deleted(ids))
      .toEqual([false, false, false, false, false]);

    await f.menu("Delete read notifications for completed issues");
    await expect
      .poll(() => f.deleted(ids))
      .toEqual([false, false, true, false, false]);
    await page
      .getByRole("button", { name: "Notification actions", exact: true })
      .click();
    await page.keyboard.down("Alt");
    await page
      .getByRole("menuitem", {
        name: "Delete notifications for completed issues",
        exact: true,
      })
      .click();
    await page.keyboard.up("Alt");
    await page
      .getByRole("button", { name: "Delete notifications", exact: true })
      .click();
    await expect
      .poll(() => f.deleted(ids))
      .toEqual([false, false, true, true, false]);
    await expect(page.locator(".inbox-item")).toHaveCount(1);
    await f.menu("Delete all");
    await expect
      .poll(() => f.deleted(ids))
      .toEqual([true, true, true, true, false]);
    await expect(
      page.getByRole("heading", { name: "You're all caught up", exact: true }),
    ).toBeVisible();
    expect(f.errors).toEqual([]);
  } finally {
    await page.close();
    await f.app.close();
  }
});

test("snoozing an Inbox row affects every group member and manual unsnooze keeps the native representative-only behavior", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const f = await fixture(page);
  try {
    const issue = await f.issue("Snoozed conversation"),
      neighbor = await f.issue("Following conversation");
    const first = await f.notice(issue.id),
      mention = await f.notice(issue.id, { type: "mentioned" });
    await f.notice(neighbor.id);
    const group = page.locator(
      `[data-notification-stack-id="issue#${issue.id}"]`,
    );
    const other = page.locator(
      `[data-notification-stack-id="issue#${neighbor.id}"]`,
    );
    await page.goto(`${f.url}/inbox`);
    await group.click();
    await page
      .getByRole("button", { name: "Snooze notification", exact: true })
      .click();
    await page.getByRole("button", { name: /^Tomorrow/ }).click();
    await expect
      .poll(async () => {
        const state = await f.state();
        const a = state.notifications.find((n: any) => n.id === first.id),
          b = state.notifications.find((n: any) => n.id === mention.id);
        return !!a?.snoozedUntil && a.snoozedUntil === b?.snoozedUntil;
      })
      .toBe(true);
    await expect(group).toHaveCount(0);
    await expect(other).toHaveClass(/active/);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("switch", { name: "Show snoozed", exact: true })
      .check();
    await page.keyboard.press("Escape");
    await expect(group).toBeVisible();
    const representative = await group.getAttribute("data-notification-id");
    expect([first.id, mention.id]).toContain(representative);
    await group.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Unsnooze", exact: true }).click();
    await expect
      .poll(async () => {
        const state = await f.state();
        return [first.id, mention.id].map(
          (id) =>
            !!state.notifications.find((n: any) => n.id === id)?.snoozedUntil,
        );
      })
      .toEqual([first.id, mention.id].map((id) => id !== representative));
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("switch", { name: "Show snoozed", exact: true })
      .uncheck();
    await page.keyboard.press("Escape");
    await expect(group).toBeVisible();
    await page.reload();
    await expect(group).toBeVisible();
    expect(f.errors).toEqual([]);
  } finally {
    await page.close();
    await f.app.close();
  }
});
