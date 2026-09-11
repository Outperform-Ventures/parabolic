import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import type { Actor } from "../../src/server/repository";

test("Subscriber filter agrees with API and saved views when another user subscribes or unsubscribes", async ({
  page,
  browser,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    other = await browser.newContext();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "sub-filter-owner@example.test",
        password: "owner-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      team = state.teams[0];
    const actor: Actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["admin"],
    };
    const invite = await (
      await page.request.post(url + "/api/v1/invitations", {
        data: { email: "sub-filter-member@example.test" },
      })
    ).json();
    const member = await (
      await other.request.post(url + "/auth/join", {
        data: {
          token: invite.token,
          name: "Other subscriber",
          password: "member-password",
        },
      })
    ).json();
    const issue = app.repo.create(actor, "issues", {
        title: "Followed through subscription record",
        teamId: team.id,
      }),
      outside = app.repo.create(actor, "issues", {
        title: "Not followed by colleague",
        teamId: team.id,
      });
    const sub = await (
      await other.request.post(url + "/api/v1/subscriptions", {
        data: { issueId: issue.id },
      })
    ).json();
    await page.goto(url + "/team/" + team.id + "/all");
    await expect(page.locator(".issue-row")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Filter issues", exact: true })
      .click();
    await page.getByRole("button", { name: "Add filter", exact: true }).click();
    await page
      .locator(".filter-condition select")
      .nth(0)
      .selectOption("subscribers");
    await page
      .locator(".filter-condition select")
      .nth(2)
      .selectOption(member.user.id);
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await expect(page.locator(".issue-row")).toContainText(issue.title);
    const filters = {
      match: "all",
      conditions: [
        { field: "subscribers", operator: "eq", value: member.user.id },
      ],
    };
    const read = async () =>
      await (
        await page.request.get(
          url +
            "/api/v1/issues?filter=" +
            encodeURIComponent(JSON.stringify(filters)),
        )
      ).json();
    expect((await read()).nodes.map((e: any) => e.id)).toEqual([issue.id]);
    const view = app.repo.create(actor, "views", {
      name: "Followed by colleague",
      entityType: "issues",
      filters,
    });
    await page.goto(url + "/view/" + view.id);
    await page.reload();
    await expect(page.locator(".issue-row")).toHaveCount(1);
    expect(
      (
        await other.request.delete(url + "/api/v1/subscriptions/" + sub.id)
      ).ok(),
    ).toBeTruthy();
    await expect(page.locator(".issue-row")).toHaveCount(0);
    expect((await read()).totalCount).toBe(0);
    await other.request.post(url + "/api/v1/subscriptions", {
      data: { issueId: outside.id },
    });
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await expect(page.locator(".issue-row")).toContainText(outside.title);
    await page.goto(
      url + "/my-issues?tab=Subscribed&assignee=" + member.user.id,
    );
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await expect(page.locator(".issue-row")).toContainText(outside.title);
    expect(
      (await (await page.request.get(url + "/api/v1/subscriptions")).json())
        .nodes,
    ).toEqual([]);
  } finally {
    await other.close();
    await page.close();
    await app.close();
  }
});

test("Subscriber saved view updates for offline unsubscribe and survives reload/reconnect", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  let disconnected = false;
  const listeners = app.server.listeners("request");
  if (browserName === "webkit") {
    app.server.removeAllListeners("request");
    app.server.on("request", (request, response) => {
      if (disconnected) {
        request.socket.destroy();
        return;
      }
      for (const listener of listeners)
        listener.call(app.server, request, response);
    });
  }
  const offline = async (value: boolean) => {
    if (browserName === "webkit") {
      disconnected = value;
      if (value) app.server.closeAllConnections();
    } else await context.setOffline(value);
  };
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "offline-sub-filter@example.test",
        password: "owner-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      actor: Actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["admin"],
      };
    const issue = app.repo.create(actor, "issues", {
      title: "Offline followed issue",
      teamId: state.teams[0].id,
    });
    app.repo.update(actor, "issues", issue.id, { subscriberIds: [] });
    app.repo.create(actor, "subscriptions", { issueId: issue.id });
    const view = app.repo.create(actor, "views", {
      name: "My subscriptions",
      entityType: "issues",
      filters: {
        match: "all",
        conditions: [
          { field: "subscribers", operator: "eq", value: actor.userId },
        ],
      },
    });
    await page.goto(url + "/view/" + view.id);
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await page.goto(url + "/issues/" + issue.id);
    await expect(
      page.getByRole("button", { name: "Unsubscribe from issue", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline(true);
    await page
      .getByRole("button", { name: "Unsubscribe from issue", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Subscribe to issue", exact: true }),
    ).toBeVisible();
    await page.goto(url + "/view/" + view.id, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".issue-row")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".issue-row")).toHaveCount(0);
    await offline(false);
    await expect
      .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
      .toEqual([]);
    await page.reload();
    await expect(page.locator(".issue-row")).toHaveCount(0);
  } finally {
    await offline(false);
    await page.close();
    await app.close();
  }
});

test("offline assignment automatically subscribes the new assignee in saved views", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  let disconnected = false;
  const listeners = app.server.listeners("request");
  if (browserName === "webkit") {
    app.server.removeAllListeners("request");
    app.server.on("request", (request, response) => {
      if (disconnected) {
        request.socket.destroy();
        return;
      }
      for (const listener of listeners)
        listener.call(app.server, request, response);
    });
  }
  const offline = async (value: boolean) => {
    if (browserName === "webkit") {
      disconnected = value;
      if (value) app.server.closeAllConnections();
    } else await context.setOffline(value);
  };
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Assignment owner",
        email: "offline-assigned-subscriber@example.test",
        password: "owner-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      actor: Actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["admin"],
      };
    const issue = app.repo.create(actor, "issues", {
      title: "Assign offline and follow",
      teamId: state.teams[0].id,
    });
    app.repo.update(actor, "issues", issue.id, { subscriberIds: [] });
    const view = app.repo.create(actor, "views", {
      name: "Assigned subscriber view",
      entityType: "issues",
      filters: {
        match: "all",
        conditions: [
          { field: "subscribers", operator: "eq", value: actor.userId },
        ],
      },
    });
    await page.goto(url + "/view/" + view.id);
    await expect(page.locator(".issue-row")).toHaveCount(0);
    await page.goto(url + "/issues/" + issue.id);
    await expect(
      page.getByRole("button", { name: "Change assignee", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline(true);
    await page
      .getByRole("button", { name: "Change assignee", exact: true })
      .click();
    await page
      .locator(".property-menu .menu-item")
      .filter({ hasText: "Assignment owner" })
      .click();
    await expect(
      page.getByRole("button", { name: "Change assignee", exact: true }),
    ).toContainText("Assignment owner");
    await page.goto(url + "/view/" + view.id, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await expect(page.locator(".issue-row")).toContainText(issue.title);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await page.goto(url + "/issues/" + issue.id, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Unsubscribe from issue", exact: true })
      .click();
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Edited after offline unsubscribe");
    await page.getByLabel("Issue title", { exact: true }).blur();
    await page.waitForFunction(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const open = indexedDB.open("parabolic-client");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result,
              request = db.transaction("outbox").objectStore("outbox").getAll();
            request.onerror = () => {
              db.close();
              reject(request.error);
            };
            request.onsuccess = () => {
              resolve(
                request.result.some(
                  (op) => op.data?.title === "Edited after offline unsubscribe",
                ),
              );
              db.close();
            };
          };
        }),
    );
    await page.goto(url + "/view/" + view.id, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".issue-row")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".issue-row")).toHaveCount(0);
    await page.goto(url + "/issues/" + issue.id, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Subscribe to issue", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Unsubscribe from issue", exact: true }),
    ).toBeVisible();
    await page.goto(url + "/view/" + view.id, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".issue-row")).toHaveCount(1);
    await offline(false);
    await expect
      .poll(() => {
        const saved = app.repo.raw("issues", issue.id)!;
        return {
          subscribers: saved.subscribers,
          assigneeId: saved.assigneeId,
          title: saved.title,
        };
      })
      .toEqual({
        subscribers: [actor.userId],
        assigneeId: actor.userId,
        title: "Edited after offline unsubscribe",
      });
    await page.reload();
    await expect(page.locator(".issue-row")).toHaveCount(1);
  } finally {
    await offline(false);
    await page.close();
    await app.close();
  }
});
