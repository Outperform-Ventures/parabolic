import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test.use({ serviceWorkers: "block" });

test("saved issue-view summaries use native scope-aware tabs and team quick filters", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        email: "summary-taxonomy@example.test",
        password: "summary-taxonomy-password",
        name: "Summary owner",
        workspaceName: "Summary workspace",
      },
    });
    const initial = await page.request
      .get(url + "/api/v1/state")
      .then((response) => response.json());
    const firstTeam = initial.teams[0];
    const create = async (kind: string, data: Record<string, unknown>) => {
      const response = await page.request.post(url + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const secondTeam = await create("teams", {
      name: "Second team",
      key: "SEC",
      icon: "Bolt",
      color: "#22c55e",
    });
    await create("issues", { title: "First team issue", teamId: firstTeam.id });
    await create("issues", {
      title: "Second team issue one",
      teamId: secondTeam.id,
    });
    await create("issues", {
      title: "Second team issue two",
      teamId: secondTeam.id,
    });
    const workspaceView = await create("views", {
      name: "Workspace issues",
      entityType: "issues",
      visibility: "workspace",
      filters: { conditions: [], match: "all" },
      display: { layout: "list", summaryOpen: true },
    });
    await page.goto(url + "/view/" + workspaceView.id);
    const panel = page.getByRole("complementary", {
      name: "Issue summary",
      exact: true,
    });
    const rows = page.locator(".issue-list-scroll [data-issue-id]");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("tab")).toHaveText([
      "Assignees",
      "Labels",
      "Projects",
      "Teams",
    ]);

    await panel.getByRole("tab", { name: "Teams", exact: true }).click();
    await expect(panel.locator(".view-summary-filter")).toHaveText([
      "Second team",
      firstTeam.name,
    ]);
    await expect(
      panel.getByRole("button", {
        name: "Second team: 2 issues. Show estimates",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", {
        name: firstTeam.name + ": 1 issues. Show estimates",
        exact: true,
      }),
    ).toBeVisible();
    await expect(panel.locator('[data-entity-icon="Bolt"]')).toHaveCount(1);

    const secondFilter = panel.getByRole("button", {
      name: "Filter by Second team",
      exact: true,
    });
    const count = panel.getByRole("button", {
      name: "Second team: 2 issues. Show estimates",
      exact: true,
    });
    const beforeHover = {
      filter: await secondFilter.boundingBox(),
      count: await count.boundingBox(),
    };
    await expect(secondFilter.locator(".view-summary-quick-filter")).toHaveCSS(
      "opacity",
      "0",
    );
    await secondFilter.hover();
    await expect(secondFilter.locator(".view-summary-quick-filter")).toHaveCSS(
      "opacity",
      "1",
    );
    expect(await secondFilter.boundingBox()).toEqual(beforeHover.filter);
    expect(await count.boundingBox()).toEqual(beforeHover.count);
    await secondFilter.click();
    await expect(rows).toHaveCount(2);
    await expect(
      panel.getByRole("button", {
        name: "Second team: 2 issues. Show estimates",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", {
        name: firstTeam.name + ": 1 issues. Show estimates",
        exact: true,
      }),
    ).toBeVisible();
    await secondFilter.click();
    await expect(rows).toHaveCount(3);

    await secondFilter.focus();
    await expect(secondFilter.locator(".view-summary-quick-filter")).toHaveCSS(
      "opacity",
      "1",
    );
    await panel.getByRole("tab", { name: "Teams", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      panel.getByRole("tab", { name: "Assignees", exact: true }),
    ).toBeFocused();

    const teamView = await create("views", {
      name: "Team issues",
      entityType: "issues",
      teamId: firstTeam.id,
      visibility: "workspace",
      filters: { conditions: [], match: "all" },
      display: { layout: "list", summaryOpen: true },
    });
    await page.goto(url + "/view/" + teamView.id);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("tab")).toHaveText([
      "Assignees",
      "Labels",
      "Projects",
    ]);
    await expect(
      panel.getByRole("tab", { name: "Priority", exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("tab", { name: "Teams", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
