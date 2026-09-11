import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("mentions on subscribed comment notifications honor priority preferences and badges", async ({ page, browser }) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(12_000);
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  const colleague = await browser.newContext();
  try {
    const setup = await page.request.post(`${url}/auth/setup`, { data: {
      name: "Mention recipient", email: "priority-recipient@example.test",
      password: "isolated-priority-recipient", workspaceName: "Priority reasons",
    } });
    expect(setup.ok()).toBeTruthy();
    const state = async () => (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, {data:{preferences:{...initial.user.preferences,inbox:{...initial.user.preferences?.inbox,priorityEnabled:true}}}});
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const invite = await create("invitations", { email: "priority-colleague@example.test" });
    const joined = await colleague.request.post(`${url}/auth/join`, { data: {
      token: invite.token, name: "Comment author", password: "isolated-priority-colleague",
    } });
    expect(joined.ok(), await joined.text()).toBeTruthy();
    const issue = await create("issues", {
      title: "Mention needs attention", teamId: initial.teams[0].id, assigneeId: initial.user.id,
    });
    const response = await colleague.request.post(`${url}/api/v1/comments`, { data: {
      issueId: issue.id, body: `<p>Please review this <span data-type="mention" data-id="${initial.user.id}" data-label="Mention recipient">@Mention recipient</span></p>`,
      mentionIds: [initial.user.id],
    } });
    expect(response.ok(), await response.text()).toBeTruthy();
    const notification = (await state()).notifications.find((item: any) => item.issueId === issue.id);
    expect(notification.type).toBe("comments");
    expect(notification.reasons).toEqual(expect.arrayContaining(["comments", "mentioned"]));
    await page.goto(`${url}/inbox`);
    const row = page.locator(`[data-notification-id="${notification.id}"]`);
    await expect(row).toBeVisible();
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, {data:{preferences:{...initial.user.preferences,inbox:{...initial.user.preferences?.inbox,priorityEnabled:true,badgeCount:"priority"}}}});
    const badge = page.getByRole("link", { name: "Inbox", exact: true }).locator(".sidebar-count");
    await expect(badge).toHaveText("1");
    await page.getByRole("button", { name: "Priority", exact: true }).click({ button: "right" });
    const dialog = page.getByRole("dialog", { name: "Priority inbox filter", exact: true });
    await dialog.getByRole("checkbox", { name: "Mentions", exact: true }).uncheck();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await expect(row).toBeVisible();
    await expect.poll(async () => (await state()).users.find((user: any) => user.id === initial.user.id).preferences.inbox.priorityTypes.includes("mention")).toBe(false);
    await page.reload();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await expect(row).toBeVisible();
  } finally {
    await colleague.close();
    await page.close();
    await app.close();
  }
});

test("priority inbox supports search, embedded issue edits, snooze and keyboard deletion", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Inbox QA",
        email: "inbox@example.test",
        password: "isolated-inbox-password",
        workspaceName: "Inbox QA",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, {data:{preferences:{...initial.user.preferences,inbox:{...initial.user.preferences?.inbox,priorityEnabled:true}}}});
    const issue = await (
      await page.request.post(`${url}/api/v1/issues`, {
        data: { title: "Inbox editable issue", teamId: initial.teams[0].id },
      })
    ).json();
    const notice = await (
      await page.request.post(`${url}/api/v1/notifications`, {
        data: {
          userId: initial.user.id,
          issueId: issue.id,
          title: "Your assignment",
          type: "assigned",
        },
      })
    ).json();
    const otherIssue = await (await page.request.post(`${url}/api/v1/issues`, { data: { title: "Ordinary update issue", teamId: initial.teams[0].id } })).json();
    const other = await (
      await page.request.post(`${url}/api/v1/notifications`, {
        data: {
          userId: initial.user.id,
          issueId: otherIssue.id,
          title: "Project changed",
          type: "status",
        },
      })
    ).json();
    await page.goto(`${url}/inbox`);
    await expect(
      page.locator(`[data-notification-id="${notice.id}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-notification-id="${other.id}"]`),
    ).toHaveCount(0);
    const badge = page
      .getByRole("link", { name: "Inbox", exact: true })
      .locator(".sidebar-count");
    await expect(badge).toHaveText("2");
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, {data:{preferences:{...(await state()).users.find((u:any)=>u.id===initial.user.id).preferences,inbox:{...(await state()).users.find((u:any)=>u.id===initial.user.id).preferences.inbox,badgeCount:"priority"}}}});
    await expect(badge).toHaveText("1");
    await page
      .getByLabel("Group unreads by", { exact: true })
      .selectOption("focus");
    await page
      .getByLabel("Notification ordering", { exact: true })
      .selectOption("oldest");
    await page.keyboard.press("Escape");
    await expect(badge).toHaveText("1");
    await expect(page.locator(".inbox-group-heading")).toContainText(
      "Unread",
    );
    await page.screenshot({
      path: "artifacts/verification/inbox-grouping.png",
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await expect(
      page.getByLabel("Group unreads by", { exact: true }),
    ).toHaveValue("focus");
    await expect(
      page.getByLabel("Notification ordering", { exact: true }),
    ).toHaveValue("oldest");
    await page
      .getByLabel("Group unreads by", { exact: true })
      .selectOption("none");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Add filter", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Issue priority", exact: true })
      .click();
    await page.getByRole("checkbox", { name: "High", exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", {
        name: "No matching notifications",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Remove Issue priority filter",
        exact: true,
      })
      .click();
    await expect(
      page.locator(`[data-notification-id="${notice.id}"]`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show unreads only", exact: true })
      .click();
    await page.locator(`[data-notification-id="${notice.id}"]`).click();
    await expect(page.locator(".embedded-issue")).toBeVisible();
    await expect.poll(async () => !!(await state()).notifications.find((n: any) => n.id === notice.id).readAt).toBe(true);
    await expect(
      page.locator(`[data-notification-id="${notice.id}"]`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show unreads only", exact: true })
      .click();
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Edited from inbox");
    await page.locator(`[data-notification-id="${notice.id}"]`).click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id).title,
      )
      .toBe("Edited from inbox");
    await page.keyboard.press("u");
    await expect
      .poll(async () =>
        Boolean(
          (await state()).notifications.find((n: any) => n.id === notice.id)
            .readAt,
        ),
      )
      .toBe(false);
    await page.keyboard.press("h");
    await expect(
      page.getByRole("dialog", { name: "Snooze notification", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Tomorrow/ }).click();
    await expect(
      page.locator(`[data-notification-id="${notice.id}"]`),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("switch", { name: "Show snoozed", exact: true })
      .check();
    await page.keyboard.press("Escape");
    await page
      .locator(`[data-notification-id="${notice.id}"]`)
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Unsnooze", exact: true }).click();
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await expect(
      page.locator(`[data-notification-id="${other.id}"]`),
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+f");
    await page
      .getByRole("textbox", { name: "Search notifications", exact: true })
      .fill("missing phrase");
    await expect(
      page.getByRole("heading", {
        name: "No matching notifications",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Search notifications", exact: true })
      .press("Escape");
    await page.locator(`[data-notification-id="${other.id}"]`).click();
    await page.keyboard.press("Backspace");
    await page
      .getByRole("button", { name: "Delete notifications", exact: true })
      .click();
    await expect
      .poll(async () =>
        Boolean(
          (await state()).notifications.find((n: any) => n.id === other.id)
            ?.deletedAt,
        ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByLabel("Enable priority inbox", { exact: true }).uncheck();
    await page.keyboard.press("Escape");
    await expect(page.locator(".inbox-page>.page-tabs")).toHaveCount(0);
    await page.keyboard.down("Alt");
    await page
      .getByRole("button", { name: "Notification actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Mark all as read", exact: true })
      .click();
    await page.keyboard.up("Alt");
    await expect
      .poll(
        async () =>
          (await state()).notifications.filter(
            (n: any) => !n.deletedAt && !n.readAt,
          ).length,
      )
      .toBe(0);
    await expect(badge).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
