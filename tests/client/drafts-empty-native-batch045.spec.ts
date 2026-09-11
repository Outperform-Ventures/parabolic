import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("empty Drafts matches the retained native shell and empty state", async ({
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
        name: "Draft reader",
        email: "draft-empty@example.test",
        password: "draft-empty-password",
      },
    });
    await page.goto(url + "/drafts");
    const pageView = page.locator(".drafts-page");
    await expect(pageView.locator(".page-header")).toHaveText("Drafts");
    await expect(
      pageView.getByRole("button", { name: "New issue", exact: true }),
    ).toHaveCount(0);
    await expect(
      pageView.getByText("No active drafts", { exact: true }),
    ).toBeVisible();
    await expect(pageView.locator(".drafts-empty p")).toHaveCount(0);
    await expect(pageView.locator(".drafts-empty-illustration")).toHaveAttribute(
      "viewBox",
      "0 0 104 96",
    );
  } finally {
    await page.close();
    await app.close();
  }
});
