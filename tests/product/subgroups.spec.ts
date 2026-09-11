import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("secondary groups retain sticky context and board moves and creation apply both properties", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Group QA",
        email: "group@example.test",
        password: "isolated-group-password",
        workspaceName: "Groups",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state(),
      team = initial.teams[0],
      user = initial.user;
    const create = async (data: any) =>
      (
        await page.request.post(`${url}/api/v1/issues`, {
          data: { teamId: team.id, ...data },
        })
      ).json();
    const source = await create({
      title: "Move both grouping properties",
      priority: 2,
      assigneeId: user.id,
      sortOrder: 0,
    });
    await create({
      title: "Unassigned urgent work",
      priority: 1,
      sortOrder: 10,
    });
    const actor = {
      userId: user.id,
      workspaceId: initial.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
    };
    app.repo.transaction(() => {
      for (let i = 0; i < 70; i++)
        app.repo.create(actor, "issues", {
          title: `Group context ${i}`,
          teamId: team.id,
          priority: 2,
          assigneeId: user.id,
          sortOrder: i + 1,
        });
    });
    await page.goto(`${url}/team/${team.id}/all`);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByLabel("Grouping", { exact: true }).selectOption("priority");
    await page
      .getByLabel("Sub-grouping", { exact: true })
      .selectOption("assigneeId");
    await page.keyboard.press("Escape");
    const sourceRow = page.locator(
      `[data-testid="issue-row"][data-issue-id="${source.id}"]`,
    );
    const unassigned = page.locator(
      '.issue-subgroup-header[data-group-id="none"]',
    );
    await sourceRow.dragTo(unassigned);
    await expect
      .poll(async () => {
        const issue = (await state()).issues.find(
          (i: any) => i.id === source.id,
        );
        return [issue.priority, issue.assigneeId];
      })
      .toEqual([1, null]);
    const scroll = page.locator(".issue-list-scroll");
    await scroll.evaluate((el) => (el.scrollTop = 600));
    await expect
      .poll(async () => {
        const bounds = await scroll.boundingBox(),
          headers = await page
            .locator(".group-header")
            .evaluateAll((els) =>
              els.map((el) => ({
                field: el.getAttribute("data-group-field"),
                id: el.getAttribute("data-group-id"),
                top: el.getBoundingClientRect().top,
              })),
            );
        return headers
          .filter(
            (h) =>
              h.top >= (bounds?.y ?? 0) - 1 && h.top <= (bounds?.y ?? 0) + 41,
          )
          .map((h) => h.id);
      })
      .toEqual(["2", user.id]);
    await scroll.evaluate((el) => (el.scrollTop = 0));
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page.keyboard.press("Escape");
    const target = page.locator(
      `.swimlane-cell[data-column-id="4"][data-row-id="${user.id}"]`,
    );
    await page
      .locator(`.board-card[data-issue-id="${source.id}"]`)
      .dragTo(target);
    await expect
      .poll(async () => {
        const issue = (await state()).issues.find(
          (i: any) => i.id === source.id,
        );
        return [issue.priority, issue.assigneeId];
      })
      .toEqual([4, user.id]);
    await page
      .getByRole("button", {
        name: "Add issue to Medium / No assignee",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Created in an empty intersection");
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect
      .poll(async () => {
        const issue = (await state()).issues.find(
          (i: any) => i.title === "Created in an empty intersection",
        );
        return issue && [issue.priority, issue.assigneeId ?? null];
      })
      .toEqual([3, null]);
    await page
      .getByRole("button", { name: "Toggle row Group QA", exact: true })
      .click();
    await expect(
      page.locator(`.issue-swimlane[data-row-id="${user.id}"] .swimlane-cell`),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Toggle row Group QA", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Set as default", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect
      .poll(
        async () => (await state()).teams[0].displayDefaults?.all?.subGroupBy,
      )
      .toBe("assigneeId");
    await page.reload();
    await expect(page.locator(".issue-swimlane-board")).toBeVisible();
    await page.screenshot({ path: "artifacts/product-ui/issue-swimlanes.png" });
  } finally {
    await page.close();
    await app.close();
  }
});

test("10,000 issues in 100 row groups keep swimlanes and their cards virtualized", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(20000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Swimlane QA",
        email: "lanes@example.test",
        password: "isolated-swimlane-password",
        workspaceName: "Lanes",
      },
    });
    const state = await (await page.request.get(`${url}/api/v1/state`)).json(),
      team = state.teams[0],
      actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["read", "write", "admin"],
      };
    app.repo.transaction(() => {
      for (let row = 0; row < 100; row++) {
        const project = app.repo.create(actor, "projects", {
          name: `Row ${String(row + 1).padStart(3, "0")}`,
          teamId: team.id,
        });
        for (let i = 0; i < 100; i++)
          app.repo.create(actor, "issues", {
            title: `Swimlane ${row + 1} task ${i + 1}`,
            teamId: team.id,
            projectId: project.id,
            priority: i % 5,
            sortOrder: i,
          });
      }
    });
    await page.goto(`${url}/team/${team.id}/all`);
    await expect(page.getByRole("table", { name: "Issues" })).toHaveAttribute(
      "aria-rowcount",
      "10000",
      { timeout: 60000 },
    );
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByLabel("Grouping", { exact: true }).selectOption("priority");
    await page
      .getByLabel("Sub-grouping", { exact: true })
      .selectOption("projectId");
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".issue-swimlane-board")).toHaveAttribute(
      "data-swimlane-count",
      "100",
    );
    expect(await page.locator(".issue-swimlane").count()).toBeLessThan(10);
    expect(await page.locator(".board-card").count()).toBeLessThan(160);
    await page
      .locator(".issue-list-scroll")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(
      page.getByRole("button", { name: "Toggle row Row 100", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Swimlane 100 task 2", { exact: true }),
    ).toBeVisible();
    expect(await page.locator(".issue-swimlane").count()).toBeLessThan(10);
    expect(await page.locator(".board-card").count()).toBeLessThan(160);
  } finally {
    await page.close();
    await app.close();
  }
});
