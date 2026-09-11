import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("team Views exposes the native collection favorite and retains its scoped destination", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Team Views QA",
        email: "team-views-wave011@example.test",
        password: "team-views-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      team = state.teams[0];

    await page.goto(url + "/team/" + team.id + "/views?type=projects");
    const favorite = page.getByRole("switch", {
      name: "Add to favorites",
      exact: true,
    });
    await expect(favorite).toHaveAttribute("aria-checked", "false");
    await favorite.click();
    await expect(
      page.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(async () => {
        const latest = await (
          await page.request.get(url + "/api/v1/state")
        ).json();
        const saved = latest.favorites.find(
          (item: any) =>
            !item.deletedAt &&
            item.entityId === team.id &&
            item.section === "views",
        );
        return [saved?.label, saved?.route, saved?.icon];
      })
      .toEqual([
        "Views " + team.name,
        "/team/" + team.id + "/views?type=projects",
        "Layers",
      ]);

    await page.reload();
    await expect(
      page.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .locator(".favorites-section a")
      .filter({ hasText: "Views" })
      .click();
    await expect(page).toHaveURL(
      url + "/team/" + team.id + "/views?type=projects",
    );
  } finally {
    await page.close();
    await app.close();
  }
});
