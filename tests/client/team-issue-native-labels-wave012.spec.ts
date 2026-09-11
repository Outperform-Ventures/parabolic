import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("direct team issue chrome uses current native Parabolic roles and names", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve(process.env.PARABOLIC_TEST_DIST ?? "dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Team issue owner",
        email: "team-issue-labels@example.test",
        password: "team-issue-labels-password",
      },
    });
    const state = await page.request
      .get(url + "/api/v1/state")
      .then((response) => response.json());
    const team = state.teams[0];
    for (const type of ["unstarted", "backlog"]) {
      await page.request.post(url + "/api/v1/issues", {
        data: {
          teamId: team.id,
          statusId: state.statuses.find(
            (status: any) => status.teamId === team.id && status.type === type,
          ).id,
          title: `Native semantic ${type} fixture`,
        },
      });
    }

    for (const section of ["all", "active", "backlog"] as const) {
      await page.goto(`${url}/team/${team.id}/${section}`);
      const expectedNotification =
        section === "all"
          ? "Setup team notifications"
          : section === "active"
            ? "Setup active issues notifications"
            : `Setup ${section} notifications`;
      await expect(
        page.getByRole("switch", { name: "Add to favorites", exact: true }),
      ).toHaveAttribute("aria-checked", "false");
      await expect(
        page.getByRole("button", { name: expectedNotification, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add new view", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Filter issues", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".group-count").first()).not.toHaveAttribute(
        "aria-label",
        "Toggle group count",
      );

      await page
        .getByRole("button", { name: "Display options", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Direction", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }

    const favorite = page.getByRole("switch", {
      name: "Add to favorites",
      exact: true,
    });
    await favorite.click();
    await expect(
      page.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(
      page.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
  } finally {
    await page.close();
    await app.close();
  }
});
