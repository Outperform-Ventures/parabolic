import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("final audit: populated folder creation, drag in/out, collapse, rename, removal and reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        email: "folders@example.test",
        password: "isolated-folders-password",
        name: "Folder owner",
        workspaceName: "Folder test",
      },
    });
    const state = async () =>
      (await page.request.get(url + "/api/v1/state")).json();
    const initial = await state(),
      team = initial.teams[0];
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(url + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const alpha = await create("favorites", {
        type: "view",
        label: "Alpha work",
        route: "/team/" + team.id + "/all",
        sortOrder: 0,
      }),
      beta = await create("favorites", {
        type: "view",
        label: "Beta work",
        route: "/projects",
        sortOrder: 0,
      }),
      gamma = await create("favorites", {
        type: "view",
        label: "Gamma work",
        route: "/documents",
        sortOrder: 0,
      });
    await page.goto(url + "/team/" + team.id + "/all");
    const sidebar = page.getByRole("region", {
      name: "Favorites",
      exact: true,
    });
    await sidebar
      .getByRole("button", {
        name: "Create new folder for favorites",
        exact: true,
      })
      .click();
    await sidebar
      .getByLabel("Folder name", { exact: true })
      .fill("Cancelled folder");
    await page.keyboard.press("Escape");
    expect(
      (await state()).favorites.filter((row: any) => row.type === "folder"),
    ).toHaveLength(0);
    await sidebar
      .getByRole("button", {
        name: "Create new folder for favorites",
        exact: true,
      })
      .click();
    await sidebar
      .getByLabel("Folder name", { exact: true })
      .fill("Work folder");
    await page.keyboard.press("Enter");
    await expect
      .poll(
        async () =>
          (await state()).favorites.find((row: any) => row.type === "folder")
            ?.name,
      )
      .toBe("Work folder");
    const folder = (await state()).favorites.find(
        (row: any) => row.type === "folder",
      ),
      container = sidebar.locator(
        '[data-favorite-folder-id="' + folder.id + '"]',
      );
    await sidebar
      .locator('[data-favorite-id="' + alpha.id + '"]')
      .dragTo(container.locator(".favorite-folder-heading"));
    await expect(
      container.getByRole("link", { name: "Alpha work", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await state()).favorites.find((row: any) => row.id === alpha.id)
            ?.folderId,
      )
      .toBe(folder.id);
    await sidebar.locator('[data-favorite-id="'+beta.id+'"]').dragTo(container.locator('.favorite-folder-heading'));
    await expect(container.locator('[data-favorite-id]')).toHaveCount(2);
    await container
      .getByRole("button", { name: "Work folder", exact: true })
      .click();
    await expect(container.locator("[data-favorite-id]")).toHaveCount(0);
    await page.reload();
    await expect(
      container.getByRole("button", { name: "Work folder", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await container
      .getByRole("button", { name: "Work folder", exact: true })
      .click();
    await expect(container.locator("[data-favorite-id]")).toHaveCount(2);
    await sidebar
      .getByRole("button", { name: "Actions for Work folder", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Rename folder", exact: true })
      .click();
    await sidebar.getByLabel("Folder name", { exact: true }).fill("Planning");
    await page.keyboard.press("Enter");
    await expect(
      container.getByRole("button", { name: "Planning", exact: true }),
    ).toBeVisible();
    await sidebar
      .locator('[data-favorite-id="' + alpha.id + '"]')
      .dragTo(sidebar.locator('[data-favorite-id="' + gamma.id + '"]'));
    await expect
      .poll(
        async () =>
          (await state()).favorites.find((row: any) => row.id === alpha.id)
            ?.folderId,
      )
      .toBeNull();
    await sidebar
      .getByRole("button", { name: "Actions for Planning", exact: true })
      .click();
    await page
      .getByRole("menuitem", {
        name: "Remove folder and keep favorites",
        exact: true,
      })
      .click();
    await expect(sidebar.locator("[data-favorite-folder-id]")).toHaveCount(0);
    await expect(sidebar.locator("[data-favorite-id]")).toHaveCount(3);
    await expect
      .poll(
        async () =>
          (await state()).favorites.filter(
            (row: any) =>
              [alpha.id, beta.id, gamma.id].includes(row.id) &&
              !row.deletedAt &&
              !row.folderId,
          ).length,
      )
      .toBe(3);
    await page.reload();
    await expect(sidebar.locator("[data-favorite-id]")).toHaveCount(3);
    await sidebar
      .getByRole("button", { name: "Remove favorite Alpha work", exact: true })
      .click();
    await expect(
      sidebar.getByRole("link", { name: "Alpha work", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
