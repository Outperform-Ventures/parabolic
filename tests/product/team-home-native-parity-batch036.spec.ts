import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("team home restores native team chrome and overview document member tabs", async ({
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
        name: "Team home owner",
        email: "team-home-batch036@example.test",
        password: "team-home-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((response) => response.json()),
      team = state.teams[0];
    const document = await page.request
      .post(url + "/api/v1/documents", {
        data: { title: "Team operating notes", teamId: team.id },
      })
      .then((response) => response.json());
    await page.goto(url + `/team/${team.id}/overview`);
    const tabs = page.getByRole("navigation", { name: "Page views" });
    await expect(tabs.getByRole("link")).toHaveText([
      "Overview",
      "Documents",
      "Members",
    ]);
    await expect(
      tabs.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("button", { name: "Add team to favorites", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Team actions", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add team to favorites", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Remove team from favorites",
        exact: true,
      }),
    ).toBeVisible();

    await tabs.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(url + `/team/${team.id}/documents`);
    await expect(
      tabs.getByRole("link", { name: "Documents", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("columnheader")).toHaveText([
      "Name",
      "Created",
      "Last edited",
      "Owner",
    ]);
    await expect(
      page.getByRole("link", { name: document.title, exact: true }),
    ).toHaveAttribute("href", "/document/" + document.id);
    await page.keyboard.press("Meta+k");
    await expect(
      page
        .getByRole("option")
        .filter({ hasText: "Add document to team overview…" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await tabs.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page).toHaveURL(url + `/team/${team.id}/members`);
    await expect(
      tabs.getByRole("link", { name: "Members", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page
        .locator(".team-members-list")
        .getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});
