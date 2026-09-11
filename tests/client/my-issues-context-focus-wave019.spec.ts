import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("direct My Issues context dismissal returns focus to the page root", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve(process.env.PARABOLIC_STATIC_DIR || "dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Context focus owner",
        email: "my-issues-context-focus-wave019@example.test",
        password: "context-focus-password",
      },
    });
    const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner" as const,
      scopes: ["admin"],
    };
    const issue = app.repo.create(actor, "issues", {
      title: "My Issues context focus",
      teamId: state.teams[0].id,
      assigneeId: state.user.id,
      subscriberIds: [state.user.id],
    });
    const now = new Date().toISOString();
    app.repo.save(
      "activities",
      {
        id: randomUUID(),
        workspaceId: state.workspaceId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        entityId: issue.id,
        issueId: issue.id,
        entityKind: "issues",
        actorId: state.user.id,
        action: "update",
        changes: { priority: { from: 0, to: 1 } },
      },
      "create",
      actor,
    );

    for (const tab of ["Assigned", "Created", "Subscribed", "Activity"]) {
      const route = tab === "Assigned" ? "/my-issues" : `/my-issues?tab=${tab}`;
      await page.goto(url + route);
      const row = page.locator(`[data-testid="issue-row"][data-issue-id="${issue.id}"]`);
      await expect(row).toBeVisible();
      await row.click({ button: "right" });
      await expect(page.locator(".issue-context-menu:visible")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".issue-context-menu:visible")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
    }
  } finally {
    await app.close();
  }
});
