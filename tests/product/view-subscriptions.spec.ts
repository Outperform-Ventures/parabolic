import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/server/repository";
test("personal view subscription controls persist event choices, deliver Inbox context and unsubscribe from notification settings", async ({
  page,
}, testInfo) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Viewer",
        email: "view-ui@example.test",
        password: "view-password",
      },
    });
    const state = () =>
        page.request.get(url + "/api/v1/state").then((r) => r.json()),
      initial = await state(),
      owner: Actor = {
        userId: initial.user.id,
        workspaceId: initial.workspaceId,
        role: "owner",
        scopes: ["admin"],
      },
      id = randomUUID(),
      at = new Date().toISOString();
    app.repo.save(
      "users",
      {
        id,
        workspaceId: owner.workspaceId,
        name: "Colleague",
        email: "view-colleague@example.test",
        createdAt: at,
        updatedAt: at,
        version: 1,
      },
      "create",
      owner,
    );
    app.repo.save(
      "memberships",
      {
        id: randomUUID(),
        workspaceId: owner.workspaceId,
        userId: id,
        role: "member",
        createdAt: at,
        updatedAt: at,
        version: 1,
      },
      "create",
      owner,
    );
    const colleague = { ...owner, userId: id, role: "member" },
      team = initial.teams[0],
      status = (type: string) =>
        initial.statuses.find(
          (s: any) => s.teamId === team.id && s.type === type,
        ).id;
    const view = app.repo.create(owner, "views", {
      name: "Important view",
      visibility: "workspace",
      filters: {
        conditions: [{ field: "priority", operator: "eq", value: 1 }],
        match: "all",
      },
    });
    await page.goto(url + "/view/" + view.id);
    await page
      .getByRole("button", { name: "Issue view options", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Subscribe", exact: true })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: "An issue is added to the view",
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const s = (await state()).subscriptions.find(
          (s: any) => s.entityId === view.id,
        );
        return s && [s.notifyOnAdded, s.notifyOnClosed];
      })
      .toEqual([true, false]);
    const issue = app.repo.create(colleague, "issues", {
      title: "Subscription entry",
      teamId: team.id,
      priority: 1,
      statusId: status("unstarted"),
    });
    await expect
      .poll(
        async () =>
          (await state()).notifications.filter((n: any) => n.viewId === view.id)
            .length,
      )
      .toBe(1);
    await page.goto(url + "/inbox");
    await expect(
      page.getByText("Colleague added the issue to Important view", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(url + "/view/" + view.id);
    await page
      .getByRole("button", { name: "Issue view options", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Subscribe", exact: true })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: "An issue is added to the view",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Issue view options", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Subscribe", exact: true })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: "An issue is marked completed or canceled",
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const s = (await state()).subscriptions.find(
          (s: any) => s.entityId === view.id,
        );
        return s && [s.notifyOnAdded, s.notifyOnClosed];
      })
      .toEqual([false, true]);
    await page.reload();
    await page.screenshot({
      path: testInfo.outputPath("view-subscription-settings.png"),
    });
    app.repo.update(colleague, "issues", issue.id, {
      statusId: status("completed"),
    });
    await expect
      .poll(
        async () =>
          (await state()).notifications.filter(
            (n: any) => n.viewId === view.id && n.type === "viewIssueClosed",
          ).length,
      )
      .toBe(1);
    await page
      .getByRole("button", { name: "Issue view options", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Subscribe", exact: true })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: "An issue is marked completed or canceled",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).subscriptions.filter(
            (s: any) => s.entityId === view.id && !s.deletedAt,
          ).length,
      )
      .toBe(0);
    app.repo.update(colleague, "issues", issue.id, {
      statusId: status("unstarted"),
    });
    app.repo.update(colleague, "issues", issue.id, {
      statusId: status("canceled"),
    });
    expect(
      (await state()).notifications.filter((n: any) => n.viewId === view.id),
    ).toHaveLength(2);
  } finally {
    await page.close();
    await app.close();
  }
});
