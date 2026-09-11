import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("native initiatives directory routes and workspace create semantics", async ({
  page,
}) => {
  test.setTimeout(60000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Initiative owner",
        email: "initiative-native-batch038@example.test",
        password: "initiative-native-password",
      },
    });
    await page.goto(url + "/initiatives/active");
    await expect(
      page.getByRole("heading", { name: "Initiatives", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Active", exact: true }),
    ).toHaveAttribute("href", "/initiatives/active");
    await expect(
      page.getByRole("link", { name: "Planned", exact: true }),
    ).toHaveAttribute("href", "/initiatives/planned");
    await expect(
      page.getByRole("link", { name: "All initiatives", exact: true }),
    ).toHaveAttribute("href", "/initiatives");
    await expect(
      page.getByRole("button", { name: "Add filter", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Display options", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create new initiative", exact: false }),
    ).toContainText("N, then I");
    await page
      .getByRole("button", { name: "New initiative", exact: true })
      .click();
    const form = page.getByRole("form", {
      name: "New initiative",
      exact: true,
    });
    await expect(
      form.getByRole("button", { name: "Choose icon", exact: true }),
    ).toBeVisible();
    await expect(
      form.getByLabel("Initiative name", { exact: true }),
    ).toBeFocused();
    await expect(
      form.getByLabel("Initiative summary", { exact: true }),
    ).toBeVisible();
    for (const name of [
      "Change status",
      "Change priority",
      "Change initiative owner",
      "Change initiative target date",
      "Change labels",
    ])
      await expect(
        form.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      form.getByRole("button", { name: "Lead team", exact: true }),
    ).toHaveCount(0);
    await expect(
      form.getByRole("button", { name: "Parents", exact: true }),
    ).toHaveCount(0);
    await expect(
      form.getByRole("button", { name: "Create", exact: true }),
    ).toBeDisabled();
  } finally {
    await app.close();
  }
});

test("initiative target date period and day views match retained picker semantics", async ({
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
        name: "Initiative owner",
        email: "initiative-date-batch039@example.test",
        password: "initiative-date-password",
      },
    });
    await page.goto(url + "/initiatives/active");
    await page
      .getByRole("button", { name: "New initiative", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Change initiative target date",
        exact: true,
      })
      .click();
    const picker = page.getByRole("dialog", {
        name: "Target date",
        exact: true,
      }),
      tabs = picker.getByRole("tablist", { name: "Date precision" });
    await expect(tabs.getByRole("tab")).toHaveText([
      "Day",
      "Month",
      "Quarter",
      "Half-year",
      "Year",
    ]);
    await tabs.getByRole("tab", { name: "Quarter", exact: true }).click();
    const years = picker.locator(".feature-date-year>span");
    await expect(years).toHaveCount(10);
    const currentYear = await page.evaluate(() => new Date().getUTCFullYear());
    expect(await years.allTextContents()).toEqual(
      Array.from({ length: 10 }, (_, index) => String(currentYear - 4 + index)),
    );
    await tabs.getByRole("tab", { name: "Day", exact: true }).click();
    const month = await picker
      .locator(".feature-date-calendar strong")
      .textContent();
    await expect(picker.getByRole("grid", { name: month! })).toBeVisible();
    await expect(
      picker.getByRole("gridcell", {
        name: /^Today, .+ \d+(st|nd|rd|th), \d{4}$/,
      }),
    ).toBeVisible();
    await expect(
      picker.getByRole("button", { name: "Today", exact: true }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});
