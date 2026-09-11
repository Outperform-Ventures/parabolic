import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

async function workspace(page: Page, preferences: Record<string, unknown>) {
  page.setDefaultTimeout(12_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const setup = await page.request.post(`${url}/auth/setup`, {
    data: {
      name: "Stack reader",
      email: "stack-reader@example.test",
      password: "isolated-stack-reader-password",
      workspaceName: "Inbox stacks",
    },
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const state = async () => {
    const response = await page.request.get(`${url}/api/v1/state`);
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const initial = await state();
  const create = async (kind: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const response = await page.request.patch(
    `${url}/api/v1/users/${initial.user.id}`,
    {
      data: {
        preferences: {
          ...initial.user.preferences,
          inbox: { groupBy: "none", badgeCount: "all", ...preferences },
        },
      },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const issue = (title: string) =>
    create("issues", { title, teamId: initial.teams[0].id });
  const notice = (
    issueId: string,
    type: string,
    fields: Record<string, unknown> = {},
  ) =>
    create("notifications", {
      userId: initial.user.id,
      actorId: initial.user.id,
      issueId,
      title: `Stack event ${type}`,
      type,
      ...fields,
    });
  const flags = async (ids: string[], field: "readAt" | "deletedAt") => {
    const current = await state();
    return ids.map((id) => {
      const item = current.notifications.find(
        (notification: any) => notification.id === id,
      );
      return item ? Boolean(item[field]) : null;
    });
  };
  return { app, url, state, initial, create, issue, notice, flags, errors };
}

const stack = (page: Page, id: string) =>
  page.locator(`[data-notification-stack-id="${id}"]`);
const badge = (page: Page) =>
  page
    .getByRole("link", { name: "Inbox", exact: true })
    .locator(".sidebar-count");

test("Inbox stacks collapse issue events, keep reminders separate and read or toggle every member", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const fixture = await workspace(page, {
    priorityEnabled: false,
    groupBy: "focus",
    unreadOnly: true,
  });
  try {
    const issue = await fixture.issue("Conversation represented once");
    const events = [];
    for (const type of [
      "assigned",
      "comments",
      "status",
      "reaction",
      "mentioned",
    ])
      events.push(await fixture.notice(issue.id, type));
    events.push(
      await fixture.notice(issue.id, "comments", {
        readAt: new Date().toISOString(),
      }),
    );
    const ids = events.map((event) => event.id);
    const reminder = await fixture.notice(issue.id, "reminder", {
      remindAt: new Date(Date.now() + 60_000).toISOString(),
    });
    fixture.app.scheduler.tick(new Date(Date.parse(reminder.remindAt) + 1_000));
    await expect
      .poll(async () =>
        Boolean(
          (await fixture.state()).notifications.find(
            (item: any) => item.id === reminder.id,
          )?.deliveredAt,
        ),
      )
      .toBe(true);
    await page.goto(`${fixture.url}/inbox`);
    const conversation = stack(page, `issue#${issue.id}`),
      reminderRow = stack(page, `issue-reminder#${issue.id}`);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "2",
    );
    await expect(page.locator(".inbox-item")).toHaveCount(2);
    await expect(conversation).toBeVisible();
    await expect(reminderRow).toBeVisible();
    await expect(badge(page)).toHaveText("2");
    const groups = page.locator(".inbox-group-heading");
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator("span").first()).toHaveText("Reminders");
    await expect(groups.nth(1).locator("span").first()).toHaveText("Mentions");
    await expect(groups.nth(0).locator("span").last()).toHaveText("1");
    await expect(groups.nth(1).locator("span").last()).toHaveText("1");
    await page.screenshot({
      path: testInfo.outputPath("inbox-stacks-and-counts.png"),
    });

    await conversation.click();
    await expect(page.locator(".embedded-issue")).toBeVisible();
    await expect
      .poll(() => fixture.flags(ids, "readAt"))
      .toEqual(ids.map(() => true));
    await expect(conversation).not.toHaveClass(/unread/);
    await expect(conversation).toBeVisible();
    await expect(badge(page)).toHaveText("1");
    expect(await fixture.flags([reminder.id], "readAt")).toEqual([false]);

    // Reading the group can replace its representative event. Context dismissal
    // must still restore focus through the stable stack identity.
    await conversation.click({ button: "right" });
    await page.keyboard.press("Escape");
    await expect(conversation).toBeFocused();

    await conversation.focus();
    await page.keyboard.press("u");
    await expect
      .poll(() => fixture.flags(ids, "readAt"))
      .toEqual(ids.map(() => false));
    await expect(conversation).toHaveClass(/unread/);
    // Exercise the delayed automatic-read guard after a deliberate manual unread.
    await page.waitForTimeout(650);
    expect(await fixture.flags(ids, "readAt")).toEqual(ids.map(() => false));
    await expect(badge(page)).toHaveText("2");
    await conversation.click({ modifiers: ["Alt"] });
    await expect
      .poll(() => fixture.flags(ids, "readAt"))
      .toEqual(ids.map(() => true));
    await expect(conversation).not.toHaveClass(/unread/);
    await conversation.click({ modifiers: ["Alt"] });
    await expect
      .poll(() => fixture.flags(ids, "readAt"))
      .toEqual(ids.map(() => false));
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "2",
    );
    expect(await fixture.flags([reminder.id], "readAt")).toEqual([false]);
    expect(fixture.errors).toEqual([]);
  } finally {
    await page.close();
    await fixture.app.close();
  }
});

test("Priority Mark all reads visible stacks only and searching Other finds Priority stacks", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fixture = await workspace(page, {
    priorityEnabled: true,
    priorityTypes: ["mention"],
    includeUrgent: false,
  });
  try {
    const priorityIssue = await fixture.issue("Priority search beacon");
    const otherIssue = await fixture.issue("Ordinary unreviewed conversation");
    const priority = [
      await fixture.notice(priorityIssue.id, "mentioned", {
        readAt: new Date().toISOString(),
      }),
      await fixture.notice(priorityIssue.id, "comments"),
      await fixture.notice(priorityIssue.id, "status"),
    ];
    const other = [
      await fixture.notice(otherIssue.id, "comments"),
      await fixture.notice(otherIssue.id, "status"),
    ];
    const priorityIds = priority.map((item) => item.id),
      otherIds = other.map((item) => item.id);
    await page.goto(`${fixture.url}/inbox`);
    const priorityRow = stack(page, `issue#${priorityIssue.id}`),
      otherRow = stack(page, `issue#${otherIssue.id}`);
    await expect(priorityRow).toBeVisible();
    await expect(otherRow).toHaveCount(0);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "1",
    );
    await expect(
      page.getByRole("button", { name: "Priority", exact: true }),
    ).toHaveAttribute("aria-description", "1 unread");
    await expect(
      page.getByRole("button", { name: "Other", exact: true }),
    ).toHaveAttribute("aria-description", "1 unread");
    await expect(badge(page)).toHaveText("2");
    await page.keyboard.down("Alt");
    await page
      .getByRole("button", { name: "Notification actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Mark all as read", exact: true })
      .click();
    await page.keyboard.up("Alt");
    await expect
      .poll(() => fixture.flags(priorityIds, "readAt"))
      .toEqual(priorityIds.map(() => true));
    expect(await fixture.flags(otherIds, "readAt")).toEqual(
      otherIds.map(() => false),
    );
    await expect(badge(page)).toHaveText("1");
    await expect(
      page.getByRole("button", { name: "Priority", exact: true }),
    ).toHaveAttribute("aria-description", "0 unread");

    await page.getByRole("button", { name: "Other", exact: true }).click();
    await expect(otherRow).toBeVisible();
    await expect(priorityRow).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+f");
    const search = page.getByRole("textbox", {
      name: "Search notifications",
      exact: true,
    });
    await search.fill("Priority search beacon");
    await expect(priorityRow).toBeVisible();
    await expect(otherRow).toHaveCount(0);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "1",
    );
    await search.press("Escape");
    await expect(otherRow).toBeVisible();
    await expect(priorityRow).toHaveCount(0);
    expect(await fixture.flags(otherIds, "readAt")).toEqual(
      otherIds.map(() => false),
    );
    const reset = await page.request.post(`${fixture.url}/api/v1/batch`, {
      data: {
        operations: priorityIds.map((id) => ({
          kind: "notifications",
          action: "update",
          id,
          data: { readAt: null },
        })),
      },
    });
    expect(reset.ok(), await reset.text()).toBeTruthy();
    await expect(
      page.getByRole("button", { name: "Priority", exact: true }),
    ).toHaveAttribute("aria-description", "1 unread");
    await otherRow.focus();
    await page.keyboard.press("Alt+u");
    await expect
      .poll(() => fixture.flags(otherIds, "readAt"))
      .toEqual(otherIds.map(() => true));
    expect(await fixture.flags(priorityIds, "readAt")).toEqual(
      priorityIds.map(() => false),
    );
    expect(fixture.errors).toEqual([]);
  } finally {
    await page.close();
    await fixture.app.close();
  }
});

test("Deleting an Inbox stack removes hidden members, selects the next row and Undo restores the whole group", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fixture = await workspace(page, {
    priorityEnabled: false,
    ordering: "oldest",
  });
  try {
    const target = await fixture.issue("Stack deleted and restored together"),
      neighbor = await fixture.issue("Next notification remains intact");
    const targetEvents = [
      await fixture.notice(target.id, "comments", {
        readAt: new Date().toISOString(),
      }),
      await fixture.notice(target.id, "status"),
      await fixture.notice(target.id, "mentioned"),
    ];
    const neighborEvent = await fixture.notice(neighbor.id, "comments", {
      readAt: null,
    });
    const ids = targetEvents.map((item) => item.id);
    await page.goto(`${fixture.url}/inbox`);
    const targetRow = stack(page, `issue#${target.id}`),
      neighborRow = stack(page, `issue#${neighbor.id}`);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "2",
    );
    await targetRow.click();
    await expect
      .poll(() => fixture.flags(ids, "readAt"))
      .toEqual(ids.map(() => true));
    await targetRow.focus();
    await page.keyboard.press("Backspace");
    await page
      .getByRole("button", { name: "Delete notifications", exact: true })
      .click();
    await expect
      .poll(() => fixture.flags(ids, "deletedAt"))
      .toEqual(ids.map(() => true));
    await expect(targetRow).toHaveCount(0);
    await expect(neighborRow).toHaveClass(/active/);
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      neighbor.title,
    );
    // Reading the automatically selected neighbor must not replace the deletion in Undo history.
    await expect
      .poll(() => fixture.flags([neighborEvent.id], "readAt"))
      .toEqual([true]);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "1",
    );
    expect(await fixture.flags([neighborEvent.id], "deletedAt")).toEqual([
      false,
    ]);

    await neighborRow.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(() => fixture.flags(ids, "deletedAt"))
      .toEqual(ids.map(() => false));
    await expect(targetRow).toBeVisible();
    await expect(neighborRow).toHaveClass(/active/);
    await expect(page.locator(".inbox-list")).toHaveAttribute(
      "aria-rowcount",
      "2",
    );
    const final = await fixture.state();
    expect(
      final.issues.find((issue: any) => issue.id === target.id)?.deletedAt,
    ).toBeFalsy();
    expect(
      final.issues.find((issue: any) => issue.id === neighbor.id)?.deletedAt,
    ).toBeFalsy();
    expect(await fixture.flags([neighborEvent.id], "deletedAt")).toEqual([
      false,
    ]);
    expect(fixture.errors).toEqual([]);
  } finally {
    await page.close();
    await fixture.app.close();
  }
});
