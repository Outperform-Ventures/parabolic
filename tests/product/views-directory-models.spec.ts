import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("workspace issue creation uses the retained inline builder and scoped Save to picker", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "inline-view-builder@example.test",
        password: "owner-password",
        workspaceName: "Builder",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      seed = await state(),
      actor = {
        userId: seed.user.id,
        workspaceId: seed.workspaceId,
        role: "owner" as const,
        scopes: ["admin"],
      },
      firstTeam = seed.teams[0],
      secondTeam = app.repo.create(actor, "teams", {
        name: "Ops",
        key: "OPS",
      });
    app.repo.update(actor, "teams", firstTeam.id, { name: "GTM" });

    await page.goto(url + "/views");
    await page
      .getByRole("button", { name: "Create new view", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/views\/issues\/new$/);
    const builder = page.getByRole("region", { name: "New issue view" });
    await expect(page.getByRole("dialog", { name: "New view" })).toHaveCount(0);
    await expect(
      builder.getByRole("link", { name: "Views", exact: true }),
    ).toBeVisible();
    await expect(builder.getByLabel("View title", { exact: true })).toHaveValue(
      "All issues",
    );
    await expect(
      builder.getByPlaceholder("Description (optional)"),
    ).toBeVisible();
    await expect(
      builder.getByRole("navigation", { name: "View type" }).getByRole("link"),
    ).toHaveText(["Issues", "Projects"]);
    await expect(
      builder.getByRole("button", { name: "Add filter" }),
    ).toBeVisible();
    await expect(
      builder.getByRole("button", { name: "Display options" }),
    ).toBeVisible();

    await builder.getByRole("button", { name: "Save to", exact: true }).click();
    const picker = page.getByRole("listbox", { name: "Save to destinations" });
    await expect(picker.getByRole("option")).toHaveText([
      "Personal",
      "Workspace",
      "GTM",
      "Ops",
    ]);
    await expect(
      picker.getByRole("option", { name: "Personal", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await picker.getByRole("option", { name: "Ops", exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(
      builder.getByRole("button", { name: "Save to" }),
    ).toContainText("Ops");

    await builder.getByLabel("View title", { exact: true }).fill("Ops review");
    await builder.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/view\//);
    await expect
      .poll(async () => {
        const view = (await state()).views.find(
          (row: any) => row.name === "Ops review",
        );
        return [view?.entityType, view?.visibility, view?.teamId];
      })
      .toEqual(["issues", "workspace", secondTeam.id]);
  } finally {
    await page.close();
    await app.close();
  }
});

test("view directory models isolate results, persist navigation and scope new-view defaults", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "view-directory@example.test",
        password: "owner-password",
        workspaceName: "Views",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      seed = await state(),
      team = seed.teams[0];
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(url + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok()).toBeTruthy();
      return response.json();
    };
    await create("views", {
      name: "Issue directory collection",
      entityType: "issues",
      visibility: "workspace",
    });
    await create("views", {
      name: "Project directory collection",
      entityType: "projects",
      visibility: "workspace",
    });
    await create("views", {
      name: "Initiative sibling collection",
      entityType: "initiatives",
      visibility: "workspace",
    });
    await page.goto(url + "/views");
    const models = page.getByRole("navigation", { name: "View models" }),
      rows = page.locator(".views-directory .feature-linked-row");
    await expect(models.getByRole("link")).toHaveCount(4);
    await expect(
      models.getByRole("link", { name: "Issues", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Issue directory collection");
    await models.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/type=projects/);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Project directory collection");
    await expect(
      page.locator('[aria-label="View owner Project directory collection"]'),
    ).toBeVisible();
    await expect(rows).toContainText("workspace");
    await page.reload();
    await expect(
      models.getByRole("link", { name: "Projects", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(rows).toContainText("Issue directory collection");
    await page.goForward();
    await expect(rows).toContainText("Project directory collection");
    await expect(
      page.getByRole("button", { name: "More directory options", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Create new view", exact: true })
      .first()
      .click();
    const form = page.getByRole("dialog", { name: "New view" });
    await expect(form.getByLabel("Content", { exact: true })).toHaveValue(
      "projects",
    );
    await form
      .getByLabel("Name", { exact: true })
      .fill("Created project directory view");
    await form
      .getByRole("button", { name: "Create view", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).views.find(
            (v: any) => v.name === "Created project directory view",
          )?.entityType,
      )
      .toBe("projects");
    await page.goto(url + "/views?type=unsupported");
    await expect(
      models.getByRole("link", { name: "Issues", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(rows).toContainText("Issue directory collection");
  } finally {
    await page.close();
    await app.close();
  }
});

test("team view directory keeps model and team on repeated query-driven creation", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "team-view-directory@example.test",
        password: "owner-password",
        workspaceName: "Team views",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      seed = await state(),
      team = seed.teams[0];
    const create = async (data: any) => {
      const response = await page.request.post(url + "/api/v1/views", { data });
      expect(response.ok()).toBeTruthy();
      return response.json();
    };
    await create({
      name: "Team projects directory",
      entityType: "projects",
      teamId: team.id,
      visibility: "workspace",
    });
    await create({
      name: "Workspace projects directory",
      entityType: "projects",
      visibility: "workspace",
    });
    await create({
      name: "Team issues directory",
      entityType: "issues",
      teamId: team.id,
      visibility: "workspace",
    });
    await page.goto(url + "/team/" + team.id + "/views?type=projects&new=1");
    const models = page.getByRole("navigation", { name: "View models" }),
      form = page.getByRole("dialog", { name: "New view" });
    await expect(models.getByRole("link")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "More directory options", exact: true }),
    ).toHaveCount(0);
    await expect(form.getByLabel("Content", { exact: true })).toHaveValue(
      "projects",
    );
    await expect(form.getByLabel("Location", { exact: true })).toHaveValue(
      "team:" + team.id,
    );
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(form).toBeHidden();
    await expect(page).toHaveURL(new RegExp("type=projects$"));
    await expect(
      page.locator(".views-directory .feature-linked-row"),
    ).toHaveCount(1);
    await expect(
      page.locator(".views-directory .feature-linked-row"),
    ).toContainText("Team projects directory");
    await page
      .getByRole("button", { name: "Create new view", exact: true })
      .click();
    await expect(form.getByLabel("Content", { exact: true })).toHaveValue(
      "projects",
    );
    await form
      .getByLabel("Name", { exact: true })
      .fill("Scoped directory creation");
    await form
      .getByRole("button", { name: "Create view", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).views.find(
            (v: any) => v.name === "Scoped directory creation",
          )?.teamId,
      )
      .toBe(team.id);
  } finally {
    await page.close();
    await app.close();
  }
});

test("directory display controls persist defaults and retained initiative/dashboard adapters create the selected model", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "directory-display@example.test",
        password: "owner-password",
        workspaceName: "Directory display",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      initial = await state(),
      team = initial.teams[0];
    for (const name of ["Charlie", "Alpha", "Bravo"])
      await page.request.post(url + "/api/v1/views", {
        data: { name, entityType: "issues", visibility: "workspace" },
      });
    await page.goto(url + "/views");
    const rowNames = page.locator(".views-directory-row>a");
    await expect(rowNames).toHaveText(["Alpha", "Bravo", "Charlie"]);
    await page
      .getByRole("button", { name: "Directory display options" })
      .click();
    const display = page.locator(".views-directory-display");
    await expect(
      display.getByLabel("Directory ordering").locator("option"),
    ).toHaveCount(4);
    await display.getByLabel("Directory order direction").selectOption("desc");
    await expect(rowNames).toHaveText(["Charlie", "Bravo", "Alpha"]);
    await display.getByRole("button", { name: "Created", exact: true }).click();
    await display.getByRole("button", { name: "Updated", exact: true }).click();
    await display.getByRole("button", { name: "Owner", exact: true }).click();
    await expect(
      page.locator('.views-directory-row [data-directory-column="createdAt"]'),
    ).toHaveCount(3);
    await expect(
      page.locator('.views-directory-row [data-directory-column="updatedAt"]'),
    ).toHaveCount(3);
    await expect(
      page.locator('.views-directory-row [data-directory-column="owner"]'),
    ).toHaveCount(0);
    await display
      .getByRole("button", { name: "Save as default for view", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).users[0].preferences?.viewDirectory?.[
            "workspace:views"
          ]?.default?.direction,
      )
      .toBe("desc");
    await display.getByLabel("Directory order direction").selectOption("asc");
    await expect(rowNames).toHaveText(["Alpha", "Bravo", "Charlie"]);
    await display
      .getByRole("button", { name: "Reset to view default", exact: true })
      .click();
    await expect(rowNames).toHaveText(["Charlie", "Bravo", "Alpha"]);
    await page.keyboard.press("Escape");
    await expect
      .poll(
        async () =>
          (await state()).users[0].preferences?.viewDirectory?.[
            "workspace:views"
          ]?.current?.direction,
      )
      .toBe("desc");
    await page.reload();
    await expect(rowNames).toHaveText(["Charlie", "Bravo", "Alpha"]);
    await expect(
      page.locator('.views-directory-row [data-directory-column="createdAt"]'),
    ).toHaveCount(3);
    await expect(
      page.locator('.views-directory-row [data-directory-column="owner"]'),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "View models" })
      .getByRole("link", { name: "Initiatives", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create new view", exact: true })
      .first()
      .click();
    const form = page.getByRole("dialog", { name: "New view" });
    await expect(form.getByLabel("Content", { exact: true })).toHaveValue(
      "initiatives",
    );
    await form
      .getByLabel("Name", { exact: true })
      .fill("Retained initiative directory");
    await form
      .getByRole("button", { name: "Create view", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).views.find(
            (view: any) => view.name === "Retained initiative directory",
          )?.entityType,
      )
      .toBe("initiatives");
    await page.goto(url + "/team/" + team.id + "/views?type=dashboards&new=1");
    const dashboard = page.getByRole("dialog", { name: "New dashboard" });
    await expect(dashboard.getByLabel("Team", { exact: true })).toHaveValue(
      team.id,
    );
    await dashboard
      .getByLabel("Name", { exact: true })
      .fill("Retained directory dashboard");
    await dashboard
      .getByRole("button", { name: "Create dashboard", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).dashboards.find(
            (row: any) => row.name === "Retained directory dashboard",
          )?.teamId,
      )
      .toBe(team.id);
    await page.goto(url + "/team/" + team.id + "/views?type=dashboards");
    await expect(page.locator(".views-directory-row")).toHaveCount(1);
    await expect(page.locator(".views-directory-row")).toContainText(
      "Retained directory dashboard",
    );
    await page
      .getByRole("button", { name: "Directory display options" })
      .click();
    await expect(display.getByLabel("Directory ordering")).toHaveValue("name");
    await expect(
      display.getByRole("button", { name: "Owner", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await page.screenshot({
      path:
        "artifacts/verification/views-directory-" +
        test.info().project.name +
        ".png",
    });
  } finally {
    await page.close();
    await app.close();
  }
});
