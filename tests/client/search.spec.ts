import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("workspace search finds comments and phrases, filters and previews matches, bounds its list, and works from cached data offline", async ({
  page,
  context,
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
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Search owner",
        email: "search@example.test",
        password: "isolated-search-test",
        workspaceName: "Search workspace",
      },
    });
    const initial = await (
        await page.request.get(`${url}/api/v1/state`)
      ).json(),
      team = initial.teams[0];
    const actor = {
      userId: initial.user.id,
      workspaceId: initial.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
    };
    const todo = initial.statuses.find((s: any) => s.type === "unstarted");
    const create = (kind: string, data: any) =>
      app.repo.create(actor, kind, data);
    const commentParent = create("issues", {
      teamId: team.id,
      title: "Feedback from customer",
      statusId: todo.id,
    });
    create("comments", {
      issueId: commentParent.id,
      body: "<p>The uncommon kumquat bridge phrase belongs only to this comment.</p>",
    });
    create("comments", {
      issueId: commentParent.id,
      body: "<p>A second kumquat mention should not duplicate the parent.</p>",
    });
    const phrase = create("issues", {
      teamId: team.id,
      title: "Silver creek phrase",
      statusId: todo.id,
    });
    create("issues", {
      teamId: team.id,
      title: "Silver road crosses creek",
      statusId: todo.id,
    });
    const other = create("teams", {
      name: "Secondary search team",
      key: "SST",
    });
    create("issues", { teamId: other.id, title: "Silver creek elsewhere" });
    create("issues", {
      teamId: team.id,
      title: "Silver creek archived",
      archivedAt: "2026-08-01T12:00:00.000Z",
    });
    const project = create("projects", {
      name: "Silver creek delivery",
      teamIds: [team.id],
      description: "<p>Project preview body</p>",
    });
    create("documents", {
      title: "Search notes",
      content: "<p>Silver creek documentation</p>",
      projectId: project.id,
    });
    app.repo.transaction(() => {
      for (let index = 0; index < 650; index++)
        create("issues", {
          teamId: team.id,
          title: `Indexed velocity ${index}`,
          statusId: todo.id,
        });
    });
    await page.goto(`${url}/search`);
    const input = page.getByRole("combobox", {
        name: "Search workspace content",
      }),
      results = page.getByRole("listbox", { name: "Search results" }),
      options = () => results.getByRole("option");
    await input.fill("kumquat");
    await expect(options()).toHaveCount(1);
    await expect(options().first()).toContainText("Feedback from customer");
    await options().first().click();
    await expect(page.getByLabel("Search result preview")).toBeVisible();
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Feedback from customer",
    );
    await input.fill(commentParent.identifier.replace("-", "").toLowerCase());
    await expect(options()).toHaveCount(1);
    await expect(options().first()).toContainText(commentParent.identifier);
    await input.fill('"silver creek"');
    await expect(options()).toHaveCount(5);
    await expect(
      results.getByText("Silver road crosses creek", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Issues", exact: true }).click();
    await expect(options()).toHaveCount(3);
    await page.getByRole("button", { name: "Search display options" }).click();
    await page.getByLabel("Include archived items").click();
    await expect(page.getByLabel("Include archived items")).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(options()).toHaveCount(2);
    await input.fill(`"silver creek" @${team.name}`);
    await page
      .getByRole("listbox", { name: "Search properties" })
      .getByRole("option")
      .filter({ hasText: team.name })
      .click();
    await expect(options()).toHaveCount(1);
    await expect(options().first()).toContainText(phrase.title);
    await input.fill("");
    await expect(page.locator(".search-result-count")).toContainText("500 of");
    await expect(
      page.getByText("Recent searches", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await input.fill("indexed velocity");
    await expect(page.locator(".search-result-count")).toContainText(
      "500 of 650 results",
    );
    expect(await options().count()).toBeLessThan(40);
    await results.evaluate(
      (element) => (element.scrollTop = element.scrollHeight),
    );
    await expect(options().last()).toContainText("Indexed velocity");
    await page.getByRole("button", { name: "Search display options" }).click();
    await page.getByLabel("Search ordering").selectOption("createdAt");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/sort=createdAt/);
    await expect(page.locator(".search-result-count")).toContainText(
      "500 of 650 results",
    );
    await input.fill("kumquat");
    await expect(options()).toHaveCount(1);
    await input.press("Enter");
    await expect(page).toHaveURL(`${url}/issues/${commentParent.id}`);
    await page.goto(`${url}/search`);
    await expect(
      page.getByRole("heading", { name: "Recent searches", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".search-recents")
        .getByRole("button", { name: "kumquat", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".search-recents")).toContainText(
      "Feedback from customer",
    );
    await context.setOffline(true);
    await input.fill("kumquat");
    await expect(options()).toHaveCount(1);
    await expect(page.locator(".search-result-count")).toContainText("Cached");
    await expect(options().first()).toContainText("Feedback from customer");
    await input.fill("the and");
    await expect(options()).toHaveCount(0);
    await context.setOffline(false);
    await input.fill('"silver creek"');
    await expect(options()).toHaveCount(5);
    await options().first().click();
    await page.screenshot({
      path: "artifacts/verification/workspace-search.png",
    });
    await page.setViewportSize({ width: 760, height: 850 });
    await input.fill(commentParent.identifier);
    await expect(options().first()).toContainText('Feedback from customer');
    await options().first().click();
    await expect(page).toHaveURL(`${url}/issues/${commentParent.id}`);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await page.close();
    await app.close();
  }
});
