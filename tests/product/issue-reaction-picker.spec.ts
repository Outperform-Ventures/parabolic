import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
test("native reaction search keeps focus, navigates nine columns, persists selection and clears results", async ({
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
        name: "Reaction owner",
        email: "reaction@example.test",
        password: "test-password",
      },
    });
    const state = await page.request
        .get(url + "/api/v1/state")
        .then((r) => r.json()),
      issue = await page.request
        .post(url + "/api/v1/issues", {
          data: { title: "Reaction picker", teamId: state.teams[0].id },
        })
        .then((r) => r.json());
    await page.goto(url + "/issues/" + issue.id);
    const trigger = page
        .getByLabel("Issue reactions")
        .getByRole("button", { name: "Add reaction", exact: true }),
      picker = page.getByRole("dialog", { name: "Choose emoji", exact: true });
    await trigger.click();
    const search = picker.getByRole("textbox", {
      name: "Search emoji",
      exact: true,
    });
    await expect(search).toBeFocused();
    await expect(picker.locator(".reaction-emoji-heading").first()).toHaveText(
      "Frequently used",
    );
    await expect(
      picker.locator(".reaction-quick-emojis,nav,select"),
    ).toHaveCount(0);
    await search.press("ArrowDown");
    await expect(picker.locator("button.active")).toHaveAttribute(
      "data-emoji",
      "+1",
    );
    await search.press("ArrowDown");
    await expect(picker.locator("button.active")).toHaveAttribute(
      "data-emoji",
      "smile",
    );
    await expect(search).toBeFocused();
    await search.fill("zzzznotanemoji");
    await expect(picker).toContainText("No results found");
    await expect(picker.locator("[data-emoji]")).toHaveCount(0);
    expect((await picker.boundingBox())?.height).toBe(75);
    await expect(picker.locator(".reaction-emoji-empty")).toHaveCSS(
      "font-size",
      "12px",
    );
    await expect(picker.locator(".reaction-emoji-empty")).toHaveCSS(
      "font-weight",
      "500",
    );
    for (const query of [
      ":rocket:",
      "🚀",
      "thumbs up",
      "thumbs_up",
      "shaking",
    ]) {
      await search.fill(query);
      await expect(picker).toContainText("No results found");
    }
    for (const [query, ids] of [
      ["thumbs", ["+1", "-1"]],
      ["thumbsu", ["+1"]],
      ["thumbsdown", ["-1"]],
    ] as const) {
      await search.fill(query);
      expect(
        await picker
          .locator("[data-emoji]")
          .evaluateAll((els) => els.map((e) => e.getAttribute("data-emoji"))),
      ).toEqual(ids);
    }
    await search.fill("pink");
    expect(
      await picker
        .locator("[data-emoji]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-emoji"))),
    ).toEqual([
      "fish_cake",
      "heartbeat",
      "heartpulse",
      "ribbon",
      "u5272",
      "woman-gesturing-ok",
    ]);
    await search.fill("thumb");
    expect(
      await picker
        .locator("[data-emoji]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-emoji"))),
    ).toEqual(["+1", "-1", "hand_with_index_finger_and_thumb_crossed"]);
    await picker.getByRole("button", { name: "Clear emoji search" }).click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await search.fill("rocket");
    await expect(picker.locator("[data-emoji]")).toHaveCount(3);
    expect(
      await picker
        .locator("[data-emoji]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-emoji"))),
    ).toEqual(["rocket", "female-astronaut", "male-astronaut"]);
    // Search retains the active position, clamped to its new results.
    await search.press("ArrowLeft");
    await expect(picker.locator("button.active")).toHaveAttribute(
      "data-emoji",
      "female-astronaut",
    );
    await expect(search).toBeFocused();
    await search.press("Enter");
    await expect(picker).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect
      .poll(() =>
        page.request
          .get(url + "/api/v1/issues/" + issue.id)
          .then((r) => r.json())
          .then((i) => i.reactions?.["👩‍🚀"]),
      )
      .toEqual([state.user.id]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "React 👩‍🚀", exact: true }),
    ).toBeVisible();
    await trigger.click();
    await expect(picker.locator("[data-emoji]").first()).toHaveAttribute(
      "data-emoji",
      "female-astronaut",
    );
    await search.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.getByRole("button", { name: "React 👩‍🚀", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "React 👩‍🚀", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});
