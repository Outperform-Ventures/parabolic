import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("project table rows keep table semantics without claiming an unavailable link destination", async ({ page }) => {
  const app = createApp({
    databasePath: ":memory:",
    host: "127.0.0.1",
    port: 0,
    staticDir: resolve(process.env.PARABOLIC_TEST_STATIC_DIR || "dist"),
  });
  const { url } = await app.start();

  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Project row accessibility QA",
        email: "project-row-accessibility-wave016@example.test",
        password: "project-row-accessibility-password",
      },
    });
    const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
    const project = await page.request
      .post(url + "/api/v1/projects", {
        data: {
          name: "Accessible project row",
          teamIds: [state.teams[0].id],
          status: "planned",
        },
      })
      .then((response) => response.json());
    const directoryPath = `/team/${state.teams[0].id}/projects`;
    const overviewPath = `/project/${project.id}/overview`;

    await page.goto(url + directoryPath);
    const row = page.locator(`[data-project-row="${project.id}"]`);
    await expect(row).toBeVisible();
    await expect(row).toHaveJSProperty("tagName", "TR");
    await expect(row).not.toHaveAttribute("role", "link");
    await expect(row).not.toHaveAttribute("aria-label", /.+/);
    await expect(row).not.toHaveAttribute("href", /.+/);
    await expect(page.getByRole("link", { name: `Select project ${project.name}` })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: project.name })).toHaveCount(1);

    const tableAccessibility = await page.locator(".feature-project-table").ariaSnapshot();
    expect(tableAccessibility).toContain("row");
    expect(tableAccessibility).not.toContain(`link \"Select project ${project.name}`);

    await row.locator("td").first().click({ position: { x: 70, y: 20 } });
    await expect(page).toHaveURL(url + overviewPath);

    await page.goto(url + directoryPath);
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url + overviewPath);
  } finally {
    await page.close();
    await app.close();
  }
});
