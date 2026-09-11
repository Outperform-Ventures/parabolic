import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
test("issue menu labels and date hints fit measured native dimensions", async ({
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
        name: "Layout owner",
        email: "menu-layout@example.test",
        password: "test-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((r) => r.json()),
      issue = await page.request
        .post(url + "/api/v1/issues", {
          data: { title: "Menu layout", teamId: state.teams[0].id },
        })
        .then((r) => r.json());
    await page.clock.setFixedTime(new Date("2026-09-08T12:00:00"));
    await page.goto(url + "/issues/" + issue.id);
    await page
      .getByRole("button", { name: "Issue options", exact: true })
      .click();
    const root = page.locator(".dropdown-content");
    const reference = [
      "native-action-glyphs.json",
      "native-action-glyphs-remaining.json",
    ].flatMap((file) =>
      JSON.parse(
        readFileSync(
          "artifacts/verification/issue-filter-parity/" + file,
          "utf8",
        ),
      ),
    );
    for (const glyph of reference) {
      const icon = root.locator(
        '[data-native-issue-action-icon="IssueAction' +
          glyph.name.replaceAll(" ", "") +
          '"]',
      );
      await expect(icon).toHaveAttribute("viewBox", glyph.viewBox);
      await expect(icon).toHaveAttribute("width", String(glyph.width));
      await expect(icon).toHaveAttribute("height", String(glyph.height));
      expect(await icon.innerHTML()).toBe(glyph.html);
    }
    expect((await root.boundingBox())!.width).toBe(246);
    expect((await root.getByRole("searchbox").boundingBox())!.height).toBe(1);
    await expect(root.getByRole("menuitem")).toHaveCount(14);
    await expect(root.locator(".menu-separator")).toHaveCount(4);
    await root.getByRole("searchbox").fill("Set SLA");
    await expect(
      root.getByRole("menuitem", { name: "Set SLA", exact: true }),
    ).toBeVisible();
    expect((await root.getByRole("searchbox").boundingBox())!.height).toBe(37);
    await root.getByRole("searchbox").fill("");
    for (const name of ["Create related", "Remind me"]) {
      const label = root
        .getByRole("menuitem", { name: new RegExp("^" + name) })
        .locator(":scope > span")
        .first();
      expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    }
    await root.getByRole("menuitem", { name: /^Remind me/ }).click();
    const reminder = page.getByRole("menu", { name: "Remind me", exact: true });
    expect((await reminder.boundingBox())!.width).toBe(305);
    expect(
      (await reminder.getByRole("menuitem").first().boundingBox())!.height,
    ).toBe(32);
    const dates = await reminder
      .locator(".issue-action-date-hint")
      .evaluateAll((items) =>
        items.map((e) => ({
          font: getComputedStyle(e).fontSize,
          x: e.getBoundingClientRect().right,
        })),
      );
    expect(dates).toHaveLength(4);
    expect(dates.every((d) => d.font === "13px")).toBe(true);
    expect(new Set(dates.map((d) => d.x)).size).toBe(1);
    for (const label of await reminder
      .locator(".issue-action-date-label")
      .all())
      expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    await page.screenshot({
      path: "artifacts/verification/issue-filter-parity/reminder-menu-corrected.png",
    });
    await root.evaluate((e) => (e.style.maxHeight = "300px"));
    await root
      .getByRole("menuitem", { name: /^Remind me/ })
      .scrollIntoViewIfNeeded();
    const delta = async () => {
      const a = await root
          .getByRole("menuitem", { name: /^Remind me/ })
          .boundingBox(),
        b = await reminder.getByRole("menuitem").first().boundingBox();
      return Math.abs(a!.y - b!.y);
    };
    await expect.poll(delta).toBeLessThan(1);
    await root.evaluate((e) => (e.scrollTop -= 35));
    await expect.poll(delta).toBeLessThan(1);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 610, height: 600 });
    await page
      .getByRole("button", { name: "Issue options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: /^Remind me/ }).click();
    const box = await reminder.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width).toBeLessThanOrEqual(602);
    expect(box!.y + box!.height).toBeLessThanOrEqual(592);
    await reminder.getByRole("searchbox").fill("2 days");
    await expect(reminder.getByRole("menuitem")).toHaveCount(1);
    await page.keyboard.press("Escape");
  } finally {
    await page.close();
    await app.close();
  }
});
