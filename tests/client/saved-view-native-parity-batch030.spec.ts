import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("saved issue view retains native status groups, header controls, and rebases stale display revisions", async ({
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
        name: "View owner",
        email: "saved-view-parity@example.test",
        password: "saved-view-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      team = state.teams[0],
      started = state.statuses.find(
        (status: any) => status.teamId === team.id && status.type === "started",
      ),
      todo = state.statuses.find(
        (status: any) =>
          status.teamId === team.id && status.type === "unstarted",
      );
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["admin"],
    };
    app.repo.create(actor, "issues", {
      title: "Started lower estimate",
      teamId: team.id,
      statusId: started.id,
      priority: 2,
      estimate: 2,
    });
    app.repo.create(actor, "issues", {
      title: "Started higher estimate",
      teamId: team.id,
      statusId: started.id,
      priority: 2,
      estimate: 8,
    });
    app.repo.create(actor, "issues", {
      title: "Todo urgent",
      teamId: team.id,
      statusId: todo.id,
      priority: 1,
    });
    const baseFilter = { conditions: [], match: "all" },
      view = app.repo.create(actor, "views", {
        name: "MASTER ISSUE VIEW",
        entityType: "issues",
        visibility: "workspace",
        filters: baseFilter,
        display: {
          layout: "list",
          groupBy: "statusId",
          subGroupBy: "none",
          orderBy: "priority",
          direction: "asc",
          showCompleted: false,
          showEmpty: false,
          showSubIssues: true,
          properties: ["identifier", "statusId", "priority", "estimate"],
        },
      });
    const key = `display:${state.workspaceId}:${state.user.id}:${view.id}`;
    await page.goto(url);
    await page.evaluate(
      ({ key, todoId }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            groupBy: "statusId",
            orderBy: "dueDate",
            direction: "desc",
            sortScope: "entire",
            showSortColumns: true,
            hiddenGroups: { statusId: [todoId] },
            sortRules: [
              { field: "priority", direction: "asc" },
              { field: "estimate", direction: "desc" },
            ],
          }),
        ),
      { key, todoId: todo.id },
    );
    await page.goto(url + "/view/" + view.id);
    await expect(
      page.locator(".group-header strong", { hasText: started.name }),
    ).toBeVisible();
    await expect(
      page.locator(".group-header strong", { hasText: todo.name }),
    ).toBeVisible();
    await expect(page.locator(".issue-sort-columns")).toHaveCount(0);
    const startedRows = page
      .locator(`[data-group-id="${started.id}"]`)
      .locator("xpath=following-sibling::*[contains(@class,'issue-row')]");
    await expect(
      page.locator(".issue-row").filter({ hasText: "Started higher estimate" }),
    ).toBeVisible();
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "{}"),
      key,
    );
    expect(saved.sortScope).toBe("groups");
    expect(saved.orderBy).toBe("priority");
    expect(saved.hiddenGroups).toEqual({});
    expect(saved.groupOrder?.slice(0, 3)).toEqual([
      "In Progress",
      "Todo",
      "Backlog",
    ]);
    expect(saved.sortRules).toEqual([]);
    const headerLabels = await page
      .locator(".page-header button")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")).filter(Boolean),
      );
    expect(headerLabels).toEqual(["Favorite view", "Issue view options"]);
    const toolbarLabels = await page
      .locator(".view-toolbar button")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")).filter(Boolean),
      );
    expect(toolbarLabels).not.toContain("Toggle insights");
    expect(toolbarLabels).toContain("Filter issues");
    expect(toolbarLabels).toContain("Display options");
    expect(toolbarLabels).toContain("Open details");
    void startedRows;
  } finally {
    await page.close();
    await app.close();
  }
});

test("saved view menu exposes retained native actions and metadata edit ignores temporary URL filters", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).__copiedView = value;
          },
        },
      }),
    );
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Menu owner",
        email: "saved-view-menu@example.test",
        password: "saved-view-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["admin"],
      },
      team = state.teams[0],
      baseFilter = {
        conditions: [{ field: "priority", operator: "eq", value: 1 }],
        match: "all",
      },
      view = app.repo.create(actor, "views", {
        name: "Menu view",
        description: "Saved view description",
        entityType: "issues",
        visibility: "workspace",
        filters: baseFilter,
        display: { groupBy: "statusId", orderBy: "priority" },
      });
    app.repo.create(actor, "issues", {
      title: "Issue kept beneath editor",
      teamId: team.id,
      priority: 1,
    });
    const temporary = {
      conditions: [{ field: "teamId", operator: "eq", value: team.id }],
      match: "all",
    };
    await page.goto(
      url +
        "/view/" +
        view.id +
        "?filter=" +
        encodeURIComponent(JSON.stringify(temporary)),
    );
    const options = page.getByRole("button", {
      name: "Issue view options",
      exact: true,
    });
    await options.click();
    await expect(
      page.getByRole("menuitem", { name: "Edit…", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Duplicate…", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Move to", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Subscribe", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", {
        name: "Configure custom view Slack notifications…",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("menuitem", { name: "Copy link", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", {
        name: "Export issues as CSV…",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "Delete", exact: true }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Edit…", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/view/${view.id}/edit\\?`));
    const editor = page.getByRole("form", { name: "Edit view", exact: true });
    await expect(
      editor.getByRole("button", { name: "Choose icon", exact: true }),
    ).toBeVisible();
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
      "Menu view",
    );
    await expect(editor.getByLabel("Title", { exact: true })).toHaveAttribute(
      "placeholder",
      "All issues",
    );
    await expect(editor.getByLabel("Description", { exact: true })).toHaveValue(
      "Saved view description",
    );
    await expect(
      editor.getByLabel("Description", { exact: true }),
    ).toHaveAttribute("placeholder", "Description (optional)");
    await expect(editor.getByLabel("Save to", { exact: true })).toHaveValue(
      "workspace",
    );
    for (const name of ["Cancel", "Save", "Add filter", "Display options"])
      await expect(
        editor.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByText("Issue kept beneath editor", { exact: true }),
    ).toBeVisible();
    await editor.getByLabel("Title", { exact: true }).fill("Discarded name");
    await editor
      .getByRole("button", { name: "Add filter", exact: true })
      .click();
    await expect(
      page.getByLabel("Issue filter 1 property", { exact: true }),
    ).toHaveValue("priority");
    await page
      .getByLabel("Issue filter 1 value", { exact: true })
      .selectOption("2");
    await editor
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(
      url +
        "/view/" +
        view.id +
        "?filter=" +
        encodeURIComponent(JSON.stringify(temporary)),
    );
    expect(app.repo.raw("views", view.id)?.name).toBe("Menu view");
    expect(app.repo.raw("views", view.id)?.filters).toEqual(baseFilter);
    expect(app.repo.raw("views", view.id)?.display?.layout).toBeUndefined();
    await options.click();
    await page.getByRole("menuitem", { name: "Edit…", exact: true }).click();
    const reopenedEditor = page.getByRole("form", {
      name: "Edit view",
      exact: true,
    });
    await reopenedEditor
      .getByLabel("Title", { exact: true })
      .fill("Renamed menu view");
    await reopenedEditor
      .getByRole("button", { name: "Add filter", exact: true })
      .click();
    await page
      .getByLabel("Issue filter 1 value", { exact: true })
      .selectOption("2");
    await reopenedEditor
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page.keyboard.press("Escape");
    await reopenedEditor
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => app.repo.raw("views", view.id)?.name)
      .toBe("Renamed menu view");
    expect(app.repo.raw("views", view.id)?.filters).toEqual({
      conditions: [{ field: "priority", operator: "eq", value: 2 }],
      match: "all",
    });
    expect(app.repo.raw("views", view.id)?.display?.layout).toBe("board");
    await options.click();
    await page
      .getByRole("menuitem", { name: "Copy link", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__copiedView))
      .toBe(url + "/view/" + view.id);
    await options.click();
    await page
      .getByRole("menuitem", { name: "Subscribe", exact: true })
      .click();
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: "An issue is added to the view",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: "An issue is marked completed or canceled",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(options).toBeFocused();
  } finally {
    await page.close();
    await app.close();
  }
});
