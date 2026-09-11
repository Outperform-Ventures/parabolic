import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("project archive rows preserve selection, navigation, dates, and the non-issue context safety gate", async ({ page }) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve(process.env.ARCHIVE_STATIC_DIR || "dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: { name: "Archive safety", email: "archive-safety@example.test", password: "archive-safety-password" },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: "owner" as const, scopes: ["admin"] };
    const project = app.repo.create(actor, "projects", {
      name: "Archived project safety",
      teamId: state.teams[0].id,
      archivedAt: "2026-09-04T16:19:11.000Z",
    });
    const deletedProject = app.repo.create(actor, "projects", {
      name: "Deleted project safety",
      teamId: state.teams[0].id,
      archivedAt: "2026-09-03T14:18:00.000Z",
    });
    app.repo.remove(actor, "projects", deletedProject.id);

    const archiveUrl = url + `/team/${state.teams[0].id}/archive/projects`;
    await page.goto(archiveUrl);
    const row = page.locator(`[data-archive-id="${project.id}"]`);

    await expect(row.locator("time")).toHaveText("Sep 4");
    await row.locator("time").click();
    await expect(page).toHaveURL(archiveUrl);
    await expect(row).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Escape");
    await expect(row).toHaveAttribute("aria-selected", "false");

    await row.locator("time").dblclick();
    await expect(page).toHaveURL(url + `/project/${project.id}`);

    await page.goto(archiveUrl);
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url + `/project/${project.id}`);

    await page.goto(archiveUrl);
    await row.click({ button: "right" });
    await expect(page.getByRole("menu")).toHaveCount(0);

    await row.focus();
    await page.keyboard.press("Shift+F10");

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /delete issue/i })).toHaveCount(0);
    await expect(row).toBeFocused();
    expect(app.repo.raw("projects", project.id)?.deletedAt).toBeFalsy();

    await page.getByRole("link", { name: "Recently deleted projects", exact: true }).click();
    const deletedRow = page.locator(`[data-archive-id="${deletedProject.id}"]`);
    await expect(deletedRow.locator("time")).toHaveText("Sep 11");
    await deletedRow.locator("time").click();
    await expect(page).toHaveURL(archiveUrl.replace("/projects", "/recently-deleted-projects"));
    await expect(deletedRow).toHaveAttribute("aria-selected", "true");

    await deletedRow.click({ button: "right" });
    await expect(page.getByRole("menu")).toHaveCount(0);
    await deletedRow.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /delete issue/i })).toHaveCount(0);
    await expect(deletedRow).toBeFocused();
    expect(app.repo.raw("projects", deletedProject.id, true)?.deletedAt).toBeTruthy();

  } finally {
    await page.close();
    await app.close();
  }
});
