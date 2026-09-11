import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("document Remind me uses the retained native reminder submenu and persists natural-language choices", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", { data:{ name:"Reminder owner", email:"document-reminder@example.test", password:"document-password" } });
    const document = await (await page.request.post(url + "/api/v1/documents", { data:{ title:"Reminder document", content:"<p>Reminder body</p>", visibility:"workspace" } })).json();
    await page.clock.setFixedTime(new Date("2036-09-08T12:00:00"));
    await page.goto(url + "/document/" + document.id);
    await page.getByRole("button", { name:"Document options", exact:true }).click();
    const trigger = page.getByRole("menuitem", { name:/^Remind me/ });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await trigger.click();
    const menu = page.getByRole("menu", { name:"Remind me", exact:true });
    await expect(menu).toBeVisible();
    expect(Math.round((await menu.boundingBox())!.width)).toBe(305);
    const input = menu.getByRole("searchbox", { name:"Reminder date and time", exact:true });
    await expect(input).toHaveAttribute("placeholder", "Try: 4 pm, 2 days, in 5 weeks…");
    await expect(input).toBeFocused();
    await expect(menu.getByRole("menuitem")).toHaveCount(5);
    for (const label of ["An hour from now", "Tomorrow", "Next week", "A month from now", "Custom…"])
      await expect(menu.getByRole("menuitem", { name:new RegExp(`^${label.replace("…", "\\…")}`) })).toBeVisible();
    await input.fill("2 days");
    await expect(menu.getByRole("menuitem")).toHaveCount(1);
    await expect(menu.getByRole("menuitem").first()).toContainText("In 2 days");
    await input.press("Enter");
    await expect.poll(async () => {
      const state = await (await page.request.get(url + "/api/v1/state")).json();
      return state.notifications.filter((item:any) => item.type === "reminder" && item.entityKind === "documents" && item.entityId === document.id && !item.deletedAt).length;
    }).toBe(1);
  } finally {
    await app.close();
  }
});
