import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("Duplicate remains unsaved until Save and preserves source view state", async ({
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
        email: "duplicate-view@example.test",
        password: "password1234",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["admin"],
    };
    const team = state.teams[0],
      status = state.statuses.find(
        (item: any) => item.teamId === team.id && item.type === "started",
      );
    app.repo.create(actor, "issues", {
      title: "Only urgent work",
      teamId: team.id,
      statusId: status.id,
      priority: 1,
    });
    app.repo.create(actor, "issues", {
      title: "Excluded normal work",
      teamId: team.id,
      statusId: status.id,
      priority: 2,
    });
    const filters = {
      conditions: [{ field: "priority", operator: "eq", value: 1 }],
      match: "all",
    };
    const display = {
      layout: "list",
      groupBy: "statusId",
      orderBy: "priority",
      properties: ["identifier", "priority"],
    };
    const source = app.repo.create(actor, "views", {
      name: "Source view",
      description: "Source description",
      entityType: "issues",
      visibility: "workspace",
      filters,
      display,
    });
    const before = app.repo.list(actor, "views").totalCount;
    await page.goto(url + "/view/" + source.id);
    await page.getByRole("button", { name: "Issue view options" }).click();
    await page.getByRole("menuitem", { name: "Duplicate…" }).click();
    await expect(page).toHaveURL(url + "/views/issues/new");
    await expect(page.getByLabel("View title")).toBeFocused();
    await expect(page.getByLabel("View title")).toHaveValue("All issues");
    await expect(page.getByLabel("Description")).toHaveValue("");
    await expect(page.getByLabel("Save to")).toContainText("Personal");
    await expect(
      page.getByText("Only urgent work", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Excluded normal work", { exact: true }),
    ).toHaveCount(0);
    expect(app.repo.list(actor, "views").totalCount).toBe(before);
    await page.getByLabel("View title").fill("Copied urgent work");
    await page
      .getByRole("region", { name: "New issue view" })
      .locator(".duplicate-view-actions")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\//);
    expect(
      app.repo
        .list(actor, "views")
        .nodes.find((view: any) => view.name === "Copied urgent work"),
    ).toMatchObject({
      description: "",
      visibility: "personal",
      filters,
      display,
    });
  } finally {
    await page.close();
    await app.close();
  }
});

test("Duplicate Cancel returns to its source without writing", async ({
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
        email: "duplicate-cancel@example.test",
        password: "password1234",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["admin"],
    };
    const source = app.repo.create(actor, "views", {
      name: "Original view",
      entityType: "issues",
      visibility: "personal",
      filters: { conditions: [], match: "all" },
      display: { groupBy: "statusId" },
    });
    const before = app.repo.list(actor, "views").totalCount;
    await page.goto(url + "/view/" + source.id);
    await page.getByRole("button", { name: "Issue view options" }).click();
    await page.getByRole("menuitem", { name: "Duplicate…" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(url + "/view/" + source.id);
    expect(app.repo.list(actor, "views").totalCount).toBe(before);
  } finally {
    await page.close();
    await app.close();
  }
});
