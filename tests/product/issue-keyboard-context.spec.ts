import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
test("Enter preserves the originating view return route and neighboring issue navigation", async ({
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
        name: "Owner",
        email: "keycontext@example.test",
        password: "context-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((r) => r.json()),
      team = state.teams[0],
      status = state.statuses.find(
        (s: any) => s.teamId === team.id && s.type === "started",
      );
    for (const title of ["First keyboard issue", "Second keyboard issue"])
      await page.request.post(url + "/api/v1/issues", {
        data: { teamId: team.id, statusId: status.id, title },
      });
    const route = "/team/" + team.id + "/active";
    await page.goto(url + route);
    const rows = page.locator("[data-testid=issue-row]");
    await expect(rows).toHaveCount(2);
    const secondId = await rows.nth(1).getAttribute("data-issue-id");
    await rows.first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".issue-detail-view")).toBeVisible();
    await expect(page.locator(".issue-context-link")).toHaveAttribute(
      "href",
      route,
    );
    await expect(
      page.getByRole("button", { name: "Navigate down", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".issue-context-link")).toHaveText(
      "Active issues",
    );
    const controls = page.locator(".issue-neighbor-controls"),
      buttons = controls.getByRole("button");
    await expect(buttons.first()).toHaveAttribute(
      "aria-label",
      "Navigate down",
    );
    await expect(buttons.last()).toBeDisabled();
    await expect(controls.locator(".issue-neighbor-count")).toHaveText("1 / 2");
    await expect(controls.locator(".issue-neighbor-count")).toHaveCSS(
      "font-size",
      "13px",
    );
    await expect(controls).toHaveCSS("gap", "8px");
    expect(
      (await controls.locator(".issue-neighbor-buttons").boundingBox())!.width,
    ).toBe(59);
    expect((await buttons.first().boundingBox())!.height).toBe(28);
    await expect(buttons.first().locator("svg")).toHaveAttribute("width", "16");
    await page
      .getByRole("button", { name: "Navigate down", exact: true })
      .click();
    await expect(page.locator(".issue-detail-view")).toHaveAttribute(
      "data-issue-id",
      secondId!,
    );
    await expect(buttons.first()).toBeDisabled();
    await expect(buttons.last()).toBeEnabled();
    await page.locator(".issue-context-link").click();
    await expect(page).toHaveURL(url + route);
    await expect(rows).toHaveCount(2);
  } finally {
    await page.close();
    await app.close();
  }
});
