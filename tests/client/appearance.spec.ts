import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import { hexToHsv } from "../../src/client/features/color-model";
test("icon spectrum gestures and keyboard edits persist, and the full emoji picker supports search, categories, skin tones and recent choices", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1777, height: 991 });
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
        name: "Appearance owner",
        email: "appearance@example.test",
        password: "isolated-appearance-test",
        workspaceName: "Appearance",
      },
    });
    const initial = await (
      await page.request.get(url + "/api/v1/state")
    ).json();
    const project = await (
      await page.request.post(url + "/api/v1/projects", {
        data: {
          name: "Visual project",
          teamIds: [initial.teams[0].id],
          icon: "Target",
          color: "#5e6ad2",
        },
      })
    ).json();
    const read = async () =>
      await (
        await page.request.get(url + "/api/v1/projects/" + project.id)
      ).json();
    await page.goto(url + "/project/" + project.id);
    const trigger = page.getByRole("button", {
      name: "Project icon",
      exact: true,
    });
    await trigger.click();
    const popup = page.getByRole("dialog", {
        name: "Project icon",
        exact: true,
      }),
      plane = popup.getByRole("slider", {
        name: "Color saturation and brightness",
        exact: true,
      });
    const box = await plane.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(
      box!.x + box!.width * 0.2,
      box!.y + box!.height * 0.8,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * 0.8,
      box!.y + box!.height * 0.2,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => Math.round(hexToHsv((await read()).color).s * 100))
      .toBe(80);
    await expect
      .poll(async () => Math.round(hexToHsv((await read()).color).v * 100))
      .toBe(80);
    await plane.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => Math.round(hexToHsv((await read()).color).s * 100))
      .toBe(79);
    await popup.getByRole("slider", { name: "Color hue", exact: true }).focus();
    await page.keyboard.press("Home");
    await expect
      .poll(async () => Math.round(hexToHsv((await read()).color).h))
      .toBe(0);
    await popup.getByRole("tab", { name: "Emojis", exact: true }).click();
    const input = popup.getByRole("textbox", {
      name: "Search emoji",
      exact: true,
    });
    await expect(input).toBeVisible();
    await input.fill("rocket");
    await input.press("Enter");
    await expect.poll(async () => (await read()).icon).toBe("🚀");
    await expect(trigger.locator(".emoji-icon")).toHaveText("🚀");
    await popup.getByRole("button", { name: "Flags", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(popup.locator('.entity-emoji-heading').filter({hasText:'Flags'})).toBeVisible();
    expect(await popup.locator("[data-emoji]").count()).toBeLessThan(130);
    await input.fill("waving hand");
    await popup.getByLabel("Emoji skin tone").selectOption("3");
    await input.press("ArrowDown");
    await expect(
      popup.getByRole("button", { name: "Waving Hand", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await read()).icon).toBe("👋🏽");
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await page.reload();
    await expect(trigger.locator(".emoji-icon")).toHaveText("👋🏽");
    await trigger.click();
    await expect(popup.getByLabel("Emoji skin tone")).toHaveValue("3");
    await expect(
      popup.getByText("Frequently used", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "artifacts/verification/emoji-picker.png" });
    await popup.getByRole("tab", { name: "Icons", exact: true }).click();
    await popup
      .getByRole("textbox", { name: "Search icons", exact: true })
      .fill("Target");
    await popup
      .getByRole("textbox", { name: "Search icons", exact: true })
      .press("Enter");
    await expect.poll(async () => (await read()).icon).toBe("Target");
    await page.screenshot({
      path: "artifacts/verification/color-spectrum.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
