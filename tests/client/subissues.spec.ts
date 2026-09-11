import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("sub-issues inherit parent properties, repeat creation with shift preservation, and retain personal display and manual order", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Subissue owner",
        email: "subissues@example.test",
        password: "isolated-subissue-test",
        workspaceName: "Planning",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state(),
      team = initial.teams[0],
      user = initial.users[0];
    // The documented cycle inheritance applies to children created in an active status.
    // A new team's default is Backlog; explicitly select Todo for this scenario.
    const todo = initial.statuses.find(
      (status: any) => status.teamId === team.id && status.type === "unstarted",
    );
    const configured = await page.request.patch(
      `${url}/api/v1/teams/${team.id}`,
      { data: { defaultStatusId: todo.id } },
    );
    expect(configured.ok(), await configured.text()).toBeTruthy();
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const project = await create("projects", {
        name: "Subissue project",
        teamIds: [team.id],
      }),
      cycle = await create("cycles", {
        name: "Planning cycle",
        teamId: team.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 864000000).toISOString(),
      }),
      label = await create("labels", {
        name: "Not inherited",
        teamId: team.id,
      });
    const parent = await create("issues", {
      title: "Break this work down",
      teamId: team.id,
      projectId: project.id,
      cycleId: cycle.id,
      priority: 2,
      assigneeId: user.id,
      labelIds: [label.id],
    });
    await page.goto(`${url}/issues/${parent.id}`);
    await page
      .getByRole("button", { name: "Create new sub-issue", exact: true })
      .click();
    const composer = page.locator(".issue-composer");
    await expect(composer.getByLabel("Create more")).toBeChecked();
    await expect(
      composer.getByRole("button", { name: "Change status", exact: true }),
    ).toContainText(todo.name);
    await composer
      .getByLabel("Issue title", { exact: true })
      .fill("First inherited child");
    await composer
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect(
      composer.getByLabel("Issue title", { exact: true }),
    ).toHaveValue("");
    await expect
      .poll(
        async () =>
          (await state()).issues.filter((i: any) => i.parentId === parent.id)
            .length,
      )
      .toBe(1);
    const first = (await state()).issues.find(
      (i: any) => i.title === "First inherited child",
    );
    expect(first).toMatchObject({
      priority: 2,
      projectId: project.id,
      cycleId: cycle.id,
      assigneeId: user.id,
      labelIds: [],
    });
    await composer
      .getByRole("button", { name: "Change priority", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: /Urgent/ })
      .click();
    await composer
      .getByLabel("Issue title", { exact: true })
      .fill("Second preserved child");
    await composer
      .getByRole("button", { name: "Create issue", exact: true })
      .click({ modifiers: ["Shift"] });
    await expect(
      composer.getByRole("button", { name: "Change priority", exact: true }),
    ).toContainText("Urgent");
    await expect(
      composer.getByLabel("Issue title", { exact: true }),
    ).toHaveValue("");
    await composer
      .getByLabel("Issue title", { exact: true })
      .fill("Third preserved child");
    await composer
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect(
      composer.getByRole("button", { name: "Change priority", exact: true }),
    ).toContainText("High");
    await page.keyboard.press("Escape");
    await expect(composer).toHaveCount(0);
    await expect(page.locator("[data-sub-issue-id]")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Sub-issue display options" })
      .click();
    await page.getByLabel("Sub-issue order").selectOption("Title");
    await page
      .locator(".sub-issue-display-menu")
      .getByLabel("Priority", { exact: true })
      .check();
    await page
      .locator(".sub-issue-display-menu")
      .getByLabel("Estimate", { exact: true })
      .check();
    await page.getByLabel("Always hide completed sub-issues").check();
    await page.keyboard.press("Escape");
    await page
      .locator(`[data-sub-issue-id="${first.id}"]`)
      .getByRole("button", { name: "Change status", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(page.locator("[data-sub-issue-id]")).toHaveCount(2);
    await page.reload();
    await expect(page.locator("[data-sub-issue-id]")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Sub-issue display options" })
      .click();
    await expect(page.getByLabel("Sub-issue order")).toHaveValue("Title");
    await expect(
      page.getByLabel("Always hide completed sub-issues"),
    ).toBeChecked();
    await page.getByLabel("Always hide completed sub-issues").uncheck();
    await page.keyboard.press("Escape");
    const rows = page.locator("[data-sub-issue-id]");
    await rows.nth(2).focus();
    await page.keyboard.press("Alt+Shift+ArrowUp");
    await expect
      .poll(async () =>
        (await state()).issues
          .filter((i: any) => i.parentId === parent.id)
          .every((i: any) => typeof i.subIssueSortOrder === "number"),
      )
      .toBe(true);
    await expect(rows.nth(1)).toContainText("Third preserved child");
    await page.reload();
    await expect(rows.nth(1)).toContainText("Third preserved child");
    await page.screenshot({ path: "artifacts/verification/sub-issues.png" });
    await page.setViewportSize({ width: 920, height: 540 });
    const displayTrigger = page.getByRole("button", {
      name: "Sub-issue display options",
    });
    await displayTrigger.click();
    const bounds = await page.locator(".dropdown-content").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.y).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(912);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(532);
    await page.keyboard.press("Escape");
    await expect(displayTrigger).toBeFocused();
    await page
      .locator(".page-header")
      .getByRole("button", { name: "Issue options", exact: true })
      .focus();
    await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("menuitem", { name: "Delete", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page
        .locator(".page-header")
        .getByRole("button", { name: "Issue options", exact: true }),
    ).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
