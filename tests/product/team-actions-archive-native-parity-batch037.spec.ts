import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("team actions and archive keep the retained native hierarchy and routes", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      host: "127.0.0.1",
      port: 0,
      staticDir: resolve(process.env.PARABOLIC_AUDIT_STATIC_DIR || "dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Team archive owner",
        email: "team-archive-batch037@example.test",
        password: "team-archive-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((response) => response.json()),
      team = state.teams[0];
    const archived = await page.request
      .post(url + "/api/v1/issues", {
        data: {
          title: "Retained archived issue",
          teamId: team.id,
          archivedAt: "2026-09-04T16:19:11.000Z",
        },
      })
      .then((response) => response.json());

    await page.goto(url + `/team/${team.id}/overview`);
    await expect(
      page.getByRole("button", { name: "Copy team URL", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Team actions", exact: true })
      .click();
    const menu = page.getByRole("menu");
    await expect(
      menu.getByRole("status").filter({ hasText: "Showing all items" }),
    ).toHaveText("Showing all items");
    await expect(
      menu.getByRole("searchbox", {
        name: "Filter issue actions",
        exact: true,
      }),
    ).toBeFocused();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Team settings",
      "Open archive",
      "Leave team…",
    ]);
    await menu
      .getByRole("menuitem", { name: "Leave team…", exact: true })
      .click();
    const leave = page.getByRole("dialog", {
      name: `Leave ${team.name}?`,
      exact: true,
    });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Cancel", exact: true }).click();

    await page
      .getByRole("button", { name: "Team actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Open archive", exact: true })
      .click();
    await expect(page).toHaveURL(url + `/team/${team.id}/archive`);
    await expect(
      page.getByText("Archived issues", { exact: true }).first(),
    ).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Archive views" });
    await expect(tabs.getByRole("link")).toHaveText([
      "Issues",
      "Projects",
      "Cycles",
      "Recently deleted issues",
      "Recently deleted projects",
      "Recently deleted initiatives",
      "Recently deleted documents",
    ]);
    await expect(
      tabs.getByRole("link", { name: "Issues", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.locator(`[data-archive-id="${archived.id}"]`),
    ).toBeVisible();
    const filterTrigger = page.getByRole("button", {
      name: "Add filter",
      exact: true,
    });
    await filterTrigger.click();
    await expect(
      page.getByRole("textbox", { name: "Add filter", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Advanced filter",
      /Status/,
      /Assignee/,
      /Creator/,
      /Priority/,
      /Estimate/,
      /Labels/,
      /Relations/,
      /Dates/,
      /Project/,
      /Project properties/,
      /Initiative/,
      /Customers/,
      /Subscribers/,
      /Auto-closed/,
      /Content/,
      /Links/,
      /Template/,
    ]);
    await page.keyboard.press("Escape");
    await expect(filterTrigger).toBeFocused();
  } finally {
    await page.close();
    await app.close();
  }
});
