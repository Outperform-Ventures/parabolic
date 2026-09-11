import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("desktop new tabs use the saved home and expose the retained tab action menu", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", { data: { name: "Tab owner", email: "tab-menu@example.test", password: "tab-menu-password" } });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: "owner", scopes: ["admin"] };
    app.repo.update(actor, "users", state.user.id, { preferences: { homeView: "/projects" } });
    await page.addInitScript(() => {
      const target = window as any;
      target.__copied = [];
      target.__moved = [];
      target.desktop = {
        isDesktop: true,
        platform: "darwin",
        getNavigationTabs: async () => true,
        getHardwareAcceleration: async () => ({ enabled: true, canDisable: true }),
        onCommand: () => () => {},
        setBadge: async () => {},
        setTheme: async () => {},
        notify: async () => true,
        copyText: async (value: string) => target.__copied.push(value),
        newWindow: async (route: string) => target.__moved.push(route),
      };
    });

    await page.goto(url + "/my-issues");
    await page.getByRole("button", { name: "New tab", exact: true }).click();
    await expect(page).toHaveURL(url + "/projects");
    await expect(page.locator(".app-tab")).toHaveCount(2);

    await page.locator(".app-tab.active").click({ button: "right" });
    const filter = page.getByRole("searchbox", { name: "Filter tab actions", exact: true });
    await expect(filter).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Showing all items" })).toBeAttached();
    for (const label of ["Pin tab", "New tab", "Duplicate tab", "Copy URL", "Close tab", "Close other tabs", "Move to new window"])
      await expect(page.getByRole("menuitem").filter({ hasText: label })).toBeVisible();
    await filter.fill("duplicate");
    await expect(page.getByRole("menuitem", { name: "Duplicate tab", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^Pin tab/ })).toBeHidden();
    await page.getByRole("menuitem", { name: "Duplicate tab", exact: true }).click();
    await expect(page.locator(".app-tab")).toHaveCount(3);
    await expect(page).toHaveURL(url + "/projects");

    await page.locator(".app-tab.active").click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Copy URL/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__copied.at(-1))).toBe(url + "/projects");
    await page.locator(".app-tab.active").click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Pin tab/ }).click();
    await expect(page.locator(".app-tab.active")).toHaveClass(/pinned/);

    await page.getByRole("button", { name: "New tab", exact: true }).click();
    await expect(page.locator(".app-tab")).toHaveCount(4);
    await page.locator(".app-tab.active").click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Close other tabs/ }).click();
    await expect(page.locator(".app-tab")).toHaveCount(2);

    await page.locator(".app-tab.active").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to new window", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__moved.at(-1))).toBe("/projects");
    await expect(page.locator(".app-tab")).toHaveCount(1);
    await expect(page.locator(".app-tab")).toHaveClass(/pinned/);
  } finally {
    await app.close();
  }
});
