import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("G then C follows native cycle eligibility for the selected team", async ({ page }) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Cycle shortcut QA",
        email: "cycle-shortcut-wave013@example.test",
        password: "cycle-shortcut-password",
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
    app.repo.update(actor, "teams", team.id, {
      cycleEnabled: false,
      cyclesEnabled: false,
    });

    await page.goto(url + "/team/" + team.id + "/overview");
    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect(page.locator(".issue-composer")).toBeVisible();
    await expect(page).toHaveURL(url + "/team/" + team.id + "/overview");
    await page.keyboard.press("Escape");

    app.repo.update(actor, "teams", team.id, { cyclesEnabled: true });
    await page.reload();
    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect(page).toHaveURL(url + "/team/" + team.id + "/cycles");
    await expect(page.getByText("Cycles", { exact: true }).last()).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});
