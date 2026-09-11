import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("retained Help paths open Contact us and the native keyboard reference contract", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Help owner",
        email: "help-native@example.test",
        password: "help-password",
      },
    });
    await page.goto(url + "/my-issues");
    const help = page.getByRole("button", { name: "Help", exact: true });
    await help.click();
    const helpMenu = page.getByRole("menu");
    await expect(helpMenu.getByRole("menuitem")).toHaveText([
      "Docs",
      "Contact us",
      "Keyboard shortcuts⌘ /",
      "Parabolic status",
      "Download apps",
      "SettingsG then S",
      "Slack community",
    ]);
    await expect(
      helpMenu.getByRole("menuitem", { name: "Contact us", exact: true }),
    ).toBeVisible();
    await helpMenu
      .getByRole("menuitem", { name: "Contact us", exact: true })
      .click();
    const support = page.getByRole("dialog", {
      name: "Contact us",
      exact: true,
    });
    await expect(
      support.getByText(
        "Include any relevant details, or email us directly at",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(support.getByLabel("Question", { exact: true })).toBeFocused();
    await expect(
      support.getByRole("button", {
        name: "Attach images, files, or videos",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      support.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    await help.click();
    await page.getByRole("menuitem", { name: /Keyboard shortcuts/ }).click();
    const shortcuts = page.getByRole("dialog", {
      name: "Keyboard Shortcuts",
      exact: true,
    });
    await expect(
      shortcuts.getByLabel("Search shortcuts", { exact: true }),
    ).toHaveAttribute("placeholder", "Search shortcuts");
    const headings = shortcuts.getByRole("heading", { level: 3 });
    await expect(headings.nth(0)).toHaveText("General");
    await expect(headings.nth(1)).toHaveText("Navigation");
    await expect(
      shortcuts.getByRole("heading", { name: "Go to a view", exact: true }),
    ).toHaveCount(0);
    await expect(
      shortcuts.getByRole("heading", { name: "Open an item", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});
