import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("issue-view Insights analyze the current scope, filter the same list, include archives, share context and restore full view", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        email: "view-insight@example.test",
        password: "isolated-insight-password",
        name: "Analyst",
        workspaceName: "View insights",
      },
    });
    const state = async () =>
        (await page.request.get(url + "/api/v1/state")).json(),
      initial = await state(),
      team = initial.teams[0],
      status = initial.statuses.find(
        (row: any) => row.teamId === team.id && row.type === "unstarted",
      );
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(url + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const project = await create("projects", {
        name: "Insights scoped project",
        teamIds: [team.id],
      }),
      other = await create("projects", {
        name: "Other project",
        teamIds: [team.id],
      });
    const high = await create("issues", {
        title: "Analysis high",
        teamId: team.id,
        statusId: status.id,
        projectId: project.id,
        priority: 2,
        estimate: 3,
      }),
      low = await create("issues", {
        title: "Analysis low",
        teamId: team.id,
        statusId: status.id,
        projectId: project.id,
        priority: 4,
        estimate: 5,
      });
    await create("issues", {
      title: "Analysis urgent",
      teamId: team.id,
      statusId: status.id,
      projectId: project.id,
      priority: 1,
      estimate: 2,
    });
    await create("issues", {
      title: "Analysis archived",
      teamId: team.id,
      statusId: status.id,
      projectId: project.id,
      priority: 2,
      estimate: 8,
      archivedAt: "2026-08-01T12:00:00Z",
    });
    await create("issues", {
      title: "Other scope excluded",
      teamId: team.id,
      statusId: status.id,
      projectId: other.id,
      priority: 2,
      estimate: 13,
    });
    await page.goto(url + "/project/" + project.id + "/issues");
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveCount(3);
    await page.keyboard.press("Meta+Shift+i");
    const panel = page.getByRole("complementary", {
      name: "View insights",
      exact: true,
    });
    await expect(panel).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Project details", exact: true }),
    ).toHaveCount(0);
    await panel.getByLabel("Slice", { exact: true }).selectOption("Priority");
    await expect(
      panel.getByText("3 matching issues", { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Filter view by High", exact: true })
      .click();
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveCount(1);
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveAttribute("data-issue-id", high.id);
    await panel
      .getByRole("button", { name: "Filter view by Low", exact: true })
      .click();
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveAttribute("data-issue-id", low.id);
    await page
      .locator(".insight-view-selection")
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveCount(3);
    await expect(panel).toBeVisible();
    await panel.getByLabel("Show archived issues", { exact: true }).check();
    await expect(
      panel.getByText("4 matching issues", { exact: true }),
    ).toBeVisible();
    await panel.getByLabel("Measure", { exact: true }).selectOption("Effort");
    await panel
      .getByLabel("Insight display", { exact: true })
      .selectOption("Metric");
    await expect(
      panel.getByRole("button", { name: "Explore Effort", exact: true }),
    ).toContainText("18");
    await panel
      .getByRole("button", { name: "Expand insights", exact: true })
      .click();
    await expect(panel).toHaveClass(/expanded/);
    await page.keyboard.press("Escape");
    await expect(panel).not.toHaveClass(/expanded/);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).__insightLink = value;
          },
        },
      });
    });
    await panel
      .getByRole("button", { name: "Copy insight link", exact: true })
      .click();
    const shared = await page.evaluate(() => (window as any).__insightLink);
    expect(shared).toContain("insightContext=");
    await panel
      .getByRole("button", { name: "Close insights", exact: true })
      .click();
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveCount(3);
    await expect(
      page.getByRole("complementary", { name: "Project details", exact: true }),
    ).toBeVisible();
    await page.goto(shared);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Explore Effort", exact: true }),
    ).toContainText("18");
    await panel
      .getByLabel("Insight display", { exact: true })
      .selectOption("Bar");
    await panel
      .getByRole("button", { name: "Filter view by High", exact: true })
      .click();
    await expect(
      page.locator(".issue-list-scroll [data-issue-id]"),
    ).toHaveCount(2);
    await panel
      .getByRole("button", { name: "Close insights", exact: true })
      .click();
    await page.goto(url + "/team/" + team.id + "/all");
    await page
      .getByRole("button", { name: "Toggle insights", exact: true })
      .click();
    await expect(
      panel.getByText("4 matching issues", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "artifacts/verification/view-insights.png" });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
