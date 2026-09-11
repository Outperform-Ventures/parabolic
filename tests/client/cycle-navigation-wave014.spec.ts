import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("cycle chronology rows expose link semantics and preserve lifecycle routing", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve(process.env.CYCLE_STATIC_DIR || "dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Cycle navigation QA",
        email: "cycle-navigation-wave014@example.test",
        password: "cycle-navigation-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const team = state.teams[0];
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner" as const,
      scopes: ["admin"],
    };
    const at = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString();
    const current = app.repo.create(actor, "cycles", {
      teamId: team.id,
      name: "Wave current",
      startDate: at(-2),
      endDate: at(2),
    });
    const upcoming = app.repo.create(actor, "cycles", {
      teamId: team.id,
      name: "Wave upcoming",
      startDate: at(3),
      endDate: at(7),
    });
    const completed = app.repo.create(actor, "cycles", {
      teamId: team.id,
      name: "Wave completed",
      startDate: at(-9),
      endDate: at(-5),
      completedAt: at(-5),
    });
    const startedStatus = state.statuses.find(
      (row: any) => row.type === "started",
    );
    const completedStatus = state.statuses.find(
      (row: any) => row.type === "completed",
    );
    app.repo.create(actor, "issues", {
      title: "Cycle work in progress",
      teamId: team.id,
      cycleId: completed.id,
      statusId: startedStatus.id,
    });
    app.repo.create(actor, "issues", {
      title: "Cycle work completed",
      teamId: team.id,
      cycleId: completed.id,
      statusId: completedStatus.id,
    });

    await page.goto(url + "/team/" + team.id + "/cycles");
    const expectLinkSemantics = process.env.EXPECT_CYCLE_ROW_LINKS !== "false";
    for (const [cycle, phase] of [
      [current, "Current"],
      [upcoming, "Upcoming"],
      [completed, "Completed"],
    ] as const) {
      const link = page.getByRole("link", {
        name: new RegExp(`${cycle.name} ${phase} Open menu$`),
      });
      const row = page.locator(`[data-cycle-id="${cycle.id}"]`);
      if (expectLinkSemantics) await expect(link).toBeVisible();
      else await expect(link).toHaveCount(0);
      await row.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        url + "/team/" + team.id + "/cycle/" + cycle.id,
      );
      await page.goBack();
    }

    const upcomingRow = page.locator(`[data-cycle-id="${upcoming.id}"]`);
    await upcomingRow
      .getByRole("button", { name: "Cycle actions: Wave upcoming" })
      .click();
    await expect(page).toHaveURL(url + "/team/" + team.id + "/cycles");
    await expect(
      page.getByRole("menuitem", { name: "Edit cycle…" }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Edit cycle…",
      "Change cycle dates…",
      "Start cycle today",
      "Subscribe to cycle calendar",
      "Copy cycle link",
    ]);
    await page.getByRole("menuitem", { name: "Edit cycle…" }).click();
    const edit = page.getByRole("dialog", { name: "Edit cycle" });
    await expect(edit.getByLabel("Cycle name")).toHaveValue("Wave upcoming");
    await page.keyboard.press("Escape");
    await expect(edit).toHaveCount(0);

    await page.getByRole("button", { name: "New cycle" }).first().click();
    const create = page.getByRole("dialog", { name: "New cycle" });
    await expect(create.getByLabel("Cycle name")).toBeVisible();
    await expect(create.getByLabel("Team")).toHaveValue(team.id);
    await expect(create.getByLabel("Start date")).not.toHaveValue("");
    await expect(create.getByLabel("End date")).not.toHaveValue("");
    await page.keyboard.press("Escape");

    await page.goto(url + "/team/" + team.id + "/cycle/" + completed.id);
    await expect(
      page
        .locator(".group-header strong")
        .filter({ hasText: startedStatus.name }),
    ).toBeVisible();
    await expect(
      page
        .locator(".group-header strong")
        .filter({ hasText: completedStatus.name }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cycle options" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Edit cycle name and description…",
      "Favorite⌥ F",
      "Copy link",
      "Subscribe to cycle calendar",
      "Export issues as CSV…",
    ]);
  } finally {
    await page.close();
    await app.close();
  }
});
