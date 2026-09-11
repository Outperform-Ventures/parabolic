import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("team-local Triage board keeps the native Issues header contract", async ({
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
        name: "Triage header owner",
        email: "triage-header@example.test",
        password: "test-password",
      },
    });
    const team = await page.request
      .post(url + "/api/v1/teams", {
        data: { name: "Ops", key: "OPS", icon: "Surfer", color: "#5d85ff" },
      })
      .then((response) => response.json());
    const view = await page.request
      .post(url + "/api/v1/views", {
        data: {
          name: "Triage",
          teamId: team.id,
          entityType: "issues",
          layout: "board",
          display: { layout: "board", groupBy: "statusId", showEmpty: true },
        },
      })
      .then((response) => response.json());

    await page.goto(url + "/view/" + view.id);

    const header = page.locator(".page-header");
    await expect(
      header.getByRole("link", { name: team.name, exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("heading", { name: "Issues", exact: true }),
    ).toBeVisible();
    await expect(
      header.locator('[data-entity-icon="' + (team.icon || "Users") + '"]'),
    ).toHaveCount(1);
    await expect(
      header.getByRole("button", { name: "Open notifications", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Issue view options", exact: true }),
    ).toHaveCount(0);

    const triageTab = page.locator('.page-tabs a[aria-current="page"]');
    await expect(triageTab).toHaveText("Triage");
    await expect(
      triageTab.locator('[data-entity-icon="CustomView"]'),
    ).toHaveCount(1);
    expect(
      await triageTab
        .locator("svg")
        .evaluate((node) => getComputedStyle(node).color),
    ).toBe("rgb(237, 146, 83)");
  } finally {
    await app.close();
  }
});
