import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("another member profile shares favorite state, opens notification setup, and uses the native empty copy", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: { name: "Profile owner", email: "owner@example.test", password: "owner-password" },
    });
    const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: "owner", scopes: ["admin"] };
    const memberId = randomUUID(), now = new Date().toISOString();
    app.repo.save("users", {
      id: memberId, workspaceId: state.workspaceId, name: "Empty Member", username: "empty",
      email: "empty@example.test", createdAt: now, updatedAt: now, version: 1,
    }, "create", actor);
    app.repo.save("memberships", {
      id: randomUUID(), workspaceId: state.workspaceId, userId: memberId, role: "member",
      createdAt: now, updatedAt: now, version: 1,
    }, "create", actor);

    await page.goto(url + "/profiles/" + memberId);
    const header = page.locator(".page-header");
    const details = page.getByRole("complementary", { name: "Member details" });
    await expect(
      page.getByRole("status").filter({ hasText: "No matching issues" }),
    ).toHaveText("No matching issues");
    await expect(page.getByRole("heading", { name: "No issues", exact: true })).toHaveCount(0);

    const headerFavorite = header.getByRole("switch", { name: "Add to favorites", exact: true });
    const detailsFavorite = details.getByRole("switch", { name: "Add to favorites", exact: true });
    await expect(headerFavorite).toHaveAttribute("aria-checked", "false");
    await expect(detailsFavorite).toHaveAttribute("aria-checked", "false");
    await headerFavorite.click();
    await expect(header.getByRole("switch", { name: "Remove from favorites", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(details.getByRole("switch", { name: "Remove from favorites", exact: true })).toHaveAttribute("aria-checked", "true");
    await details.getByRole("switch", { name: "Remove from favorites", exact: true }).click();
    await expect(headerFavorite).toHaveAttribute("aria-checked", "false");

    await header.getByRole("button", { name: "Setup user view notifications", exact: true }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("heading", { name: "Send inbox notifications for", exact: true })).toBeVisible();
    const assigned = menu.getByRole("checkbox", { name: "The user is assigned an issue", exact: true });
    const closed = menu.getByRole("checkbox", { name: "An issue is marked completed or canceled", exact: true });
    await expect(assigned).not.toBeChecked();await expect(closed).not.toBeChecked();
    await assigned.check();await closed.check();
    await page.keyboard.press("Escape");
    await header.getByRole("button", { name: "Setup user view notifications", exact: true }).click();
    await expect(menu.getByRole("checkbox", { name: "The user is assigned an issue", exact: true })).toBeChecked();
    await expect(menu.getByRole("checkbox", { name: "An issue is marked completed or canceled", exact: true })).toBeChecked();
    await page.reload();
    await header.getByRole("button", { name: "Setup user view notifications", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "The user is assigned an issue", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "An issue is marked completed or canceled", exact: true })).toBeChecked();
    await page.keyboard.press("Escape");

    await page.goto(url + "/profiles/" + state.user.id);
    await expect(page.getByRole("switch", { name: /favorites/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Setup user view notifications", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Open details", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});
