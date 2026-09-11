import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("saved view details exposes the native icon picker and retained action menu", async ({
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
        name: "View owner",
        email: "saved-view-details@example.test",
        password: "saved-view-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((response) => response.json()),
      view = app.repo.create(
        {
          userId: state.user.id,
          workspaceId: state.workspaceId,
          role: "owner",
          scopes: ["admin"],
        },
        "views",
        {
          name: "Menu parity view",
          description: "Saved view details",
          entityType: "issues",
          visibility: "personal",
          icon: "CustomView",
          color: "#4eaaa2",
          filters: { match: "all", conditions: [] },
        },
      );

    await page.goto(url + "/view/" + view.id);
    await page.getByRole("button", { name: "Open details", exact: true }).click();
    const details = page.getByRole("complementary", {
      name: "Issue summary",
      exact: true,
    });

    const chooseIcon = details.getByRole("button", {
      name: "Choose icon",
      exact: true,
    });
    await chooseIcon.click();
    const picker = page.getByRole("dialog", {
      name: "Choose icon",
      exact: true,
    });
    await expect(picker.getByRole("tab")).toHaveText(["Icons", "Emojis"]);
    await expect(
      picker.getByRole("textbox", { name: "Search icons", exact: true }),
    ).toBeFocused();
    await picker.getByRole("tab", { name: "Emojis", exact: true }).click();
    await expect(
      picker.getByRole("textbox", { name: "Search emoji", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(chooseIcon).toBeFocused();

    const openMenu = details.getByRole("button", {
      name: "Open menu",
      exact: true,
    });
    await openMenu.click();
    const menu = page.getByRole("menu").filter({
      has: page.getByRole("menuitem", { name: "Edit…", exact: true }),
    });
    await expect(
      menu.getByRole("searchbox", { name: "Filter view actions", exact: true }),
    ).toBeFocused();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Edit…",
      "Copy link",
      "Delete",
    ]);
    await page.keyboard.press("Escape");
    await expect(openMenu).toBeFocused();

    await openMenu.click();
    await menu.getByRole("menuitem", { name: "Copy link", exact: true }).click();
    const sharing = page.getByRole("dialog", {
      name: "Personal views can't be shared",
      exact: true,
    });
    await expect(sharing.getByLabel("Visibility", { exact: true })).toHaveValue(
      "personal",
    );
    await expect(
      sharing.getByRole("button", { name: "Change visibility", exact: true }),
    ).toBeDisabled();
    await sharing.getByRole("button", { name: "Cancel", exact: true }).click();

    await openMenu.click();
    await menu.getByRole("menuitem", { name: "Edit…", exact: true }).click();
    const editor = page.getByRole("form", { name: "Edit view", exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();

    await openMenu.click();
    await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Delete view", exact: true }),
    ).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});
