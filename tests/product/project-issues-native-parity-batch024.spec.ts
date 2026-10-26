import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("project issues match native scoped filters, row actions, selection, grouping, and creation context", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      host: "127.0.0.1",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Project parity",
        email: "project-parity-batch024@example.test",
        password: "project-parity-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((response) => response.json()),
      team = state.teams[0],
      started = state.statuses.find(
        (status: any) => status.teamId === team.id && status.type === "started",
      );
    const project = await page.request
      .post(url + "/api/v1/projects", {
        data: { name: "Native parity project", teamIds: [team.id] },
      })
      .then((response) => response.json());
    const milestone = await page.request
      .post(url + "/api/v1/milestones", {
        data: { name: "Release checkpoint", projectId: project.id },
      })
      .then((response) => response.json());
    const issue = await page.request
      .post(url + "/api/v1/issues", {
        data: {
          title: "Native parity issue",
          teamId: team.id,
          projectId: project.id,
          statusId: started.id,
          priority: 3,
          estimate: 8,
        },
      })
      .then((response) => response.json());
    await page.goto(url + "/project/" + project.id + "/issues");

    await page
      .getByRole("button", { name: "Filter issues", exact: true })
      .click();
    const filter = page.getByRole("menu");
    for (const name of [
      "Status",
      "Assignee",
      "Creator",
      "Priority",
      "Estimate",
      "Labels",
      "Relations",
      "Dates",
      "Project milestone",
      "Customers",
      "Subscribers",
      "Auto-closed",
      "Content",
      "Links",
      "Template",
    ])
      await expect(
        filter.getByRole("menuitem", { name, exact: true }),
      ).toBeVisible();
    for (const name of ["Team", "Project", "Project properties", "Initiative"])
      await expect(
        filter.getByRole("menuitem", { name, exact: true }),
      ).toHaveCount(0);
    await filter
      .getByRole("menuitem", { name: "Project milestone", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: new RegExp("^" + milestone.name) })
      .click();
    await expect(page.locator(`[data-issue-id="${issue.id}"]`)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    const row = page.locator(`[data-issue-id="${issue.id}"]`);
    await expect(row).toBeVisible();

    await row.click({ button: "right" });
    const actions = page.getByRole("menu");
    await expect(
      actions.getByRole("status").filter({ hasText: "Showing all items" }),
    ).toHaveText("Showing all items");
    await expect(
      actions.getByRole("searchbox", {
        name: "Filter issue actions",
        exact: true,
      }),
    ).toBeFocused();
    await expect(
      actions.getByRole("menuitem", { name: "Milestone", exact: true }),
    ).toBeVisible();
    await expect(
      actions.getByRole("menuitem", { name: "Move", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    const display = page.locator(".display-options");
    await expect(
      display.getByRole("button", { name: "Display projectId", exact: true }),
    ).toHaveCount(0);
    await expect(
      display.getByRole("button", { name: "Reset", exact: true }),
    ).toHaveCount(0);
    await expect(
      display.getByRole("button", { name: "Set as default", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await row
      .getByRole("button", { name: `Select ${issue.identifier}`, exact: true })
      .click();
    const toolbar = page.getByRole("toolbar", {
      name: "Selected issues",
      exact: true,
    });
    await expect(toolbar).toContainText("1 selected");
    await toolbar
      .getByRole("button", { name: "Clear selected", exact: true })
      .click();
    await expect(toolbar).toHaveCount(0);

    const header = page
      .locator(".group-header")
      .filter({ hasText: started.name });
    const toggle = header.getByRole("button", {
      name: "Collapse group",
      exact: true,
    });
    await toggle.click();
    await expect(row).toHaveCount(0);
    await header
      .getByRole("button", { name: "Expand group", exact: true })
      .click();
    await expect(row).toBeVisible();

    await header
      .getByRole("button", { name: "Create new issue", exact: true })
      .click();
    const composer = page.locator(".issue-composer");
    await expect(
      composer.getByRole("button", { name: "Change project", exact: true }),
    ).toContainText(project.name);
    await expect(
      composer.getByRole("button", { name: "Change status", exact: true }),
    ).toContainText(started.name);
    await expect(
      composer.getByLabel("Quick suggestions", { exact: true }),
    ).toHaveCount(0);
    await expect(
      composer.getByRole("button", {
        name: `Apply suggested "${milestone.name}" milestone`,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      composer.getByRole("button", { name: "Change milestone", exact: true }),
    ).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});
