import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("completed cycle detail exposes retained actions and statistics breakdowns", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "cycle-detail@example.test",
        password: "owner-password",
        workspaceName: "Cycles",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner" as const,
      scopes: ["admin"],
    };
    const team = state.teams[0];
    const completed = state.statuses.find(
      (row: any) => row.type === "completed",
    );
    const started = state.statuses.find((row: any) => row.type === "started");
    const project = app.repo.create(actor, "projects", {
      name: "Website",
      teamId: team.id,
      teamIds: [team.id],
    });
    const label = app.repo.create(actor, "labels", {
      name: "Bug",
      teamId: team.id,
    });
    const cycle = app.repo.create(actor, "cycles", {
      name: "Cycle 72",
      teamId: team.id,
      startDate: "2025-07-07",
      endDate: "2025-07-21",
      completedAt: "2025-07-21T00:00:00.000Z",
    });
    app.repo.create(actor, "issues", {
      title: "Fix payment history",
      identifier: "ENG-128",
      teamId: team.id,
      cycleId: cycle.id,
      statusId: completed.id,
      projectId: project.id,
      labelIds: [label.id],
      assigneeId: state.user.id,
      priority: 2,
    });
    app.repo.create(actor, "issues", {
      title: "Implement privacy settings",
      identifier: "ENG-116",
      teamId: team.id,
      cycleId: cycle.id,
      statusId: started.id,
      priority: 4,
    });

    await page.goto(url + "/team/" + team.id + "/cycle/" + cycle.id);
    await expect(
      page.getByRole("switch", { name: "Add to favorites", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(
      page.getByRole("button", { name: "Close cycle details", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("button", { name: "Add filter", exact: true }),
    ).toBeVisible();

    const tabs = page.getByRole("tablist", {
      name: "Cycle statistics breakdown",
    });
    await expect(tabs.getByRole("tab")).toHaveText([
      "Assignees",
      "Labels",
      "Priority",
      "Projects",
      "Teams",
    ]);
    await expect(tabs.getByRole("tab", { name: "Assignees" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await tabs.getByRole("tab", { name: "Labels" }).click();
    await expect(page.getByRole("tabpanel", { name: "Labels" })).toContainText(
      "Bug",
    );
    await tabs.getByRole("tab", { name: "Priority" }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Priority" }),
    ).toContainText("High");
    await tabs.getByRole("tab", { name: "Projects" }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Projects" }),
    ).toContainText("Website");

    await page
      .getByRole("button", { name: "Cycle options", exact: true })
      .click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Edit cycle name and description…",
      "Favorite⌥ F",
      "Copy link",
      "Subscribe to cycle calendar",
      "Export issues as CSV…",
    ]);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      menu
        .getByRole("menuitem", { name: "Export issues as CSV…", exact: true })
        .click(),
    ]);
    expect(download.suggestedFilename()).toBe("Cycle 72.csv");
    expect(await readFile((await download.path())!, "utf8")).toContain(
      "Fix payment history",
    );
  } finally {
    await page.close();
    await app.close();
  }
});
