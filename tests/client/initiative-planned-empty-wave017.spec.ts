import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("Planned initiatives uses native empty copy only without a search", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve(process.env.PARABOLIC_STATIC_DIR || "dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Planned initiative owner",
        email: "planned-empty-wave017@example.test",
        password: "planned-empty-password",
      },
    });
    await page.goto(url + "/initiatives/planned");
    await expect(
      page.getByRole("heading", { name: "Upcoming initiatives", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add filter", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Advanced filter", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Search…", exact: true }).fill("none");
    await expect(
      page.getByRole("heading", { name: "No matching initiatives", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Upcoming initiatives", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Try adjusting your filters or search.")).toBeVisible();
  } finally {
    await app.close();
  }
});
