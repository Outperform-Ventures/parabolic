import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("documents expose URL, title, and Markdown copy commands including Cmd-Opt-C", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{ writeText:async (text:string) => { (window as any).__documentCopy = text; } } }));
    await page.request.post(url + "/auth/setup", { data:{ name:"Copy owner", email:"document-copy@example.test", password:"document-password" } });
    const document = await (await page.request.post(url + "/api/v1/documents", { data:{ title:"Copy specification", content:"<h2>Scope</h2><p>Keep <strong>formatting</strong>.</p>", visibility:"workspace" } })).json();
    await page.goto(url + "/document/" + document.id);
    const copied = () => page.evaluate(() => (window as any).__documentCopy);
    await page.getByRole("button", { name:"Document options", exact:true }).click();
    const copyTrigger = page.getByRole("menuitem", { name:"Copy", exact:true });
    await expect(copyTrigger).toHaveAttribute("aria-haspopup", "menu");
    await copyTrigger.click();
    const copyMenu = page.getByRole("menu", { name:"Copy", exact:true });
    await expect(copyMenu.getByRole("menuitem").allTextContents()).resolves.toEqual(["Copy document URL", "Copy document as Markdown"]);
    await copyMenu.getByRole("menuitem", { name:"Copy document as Markdown", exact:true }).click();
    await expect.poll(copied).toBe("# Copy specification\n\n## Scope\n\nKeep **formatting**.");
    const command = async (label:string) => {
      const input = page.getByRole("combobox", { name:"Command menu", exact:true });
      await expect.poll(async () => {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("workspace-command", { detail:{ command:"command-menu" }, cancelable:true })));
        return input.count();
      }).toBe(1);
      await expect(input).toBeVisible();
      await input.fill(label);
      await page.getByRole("option").filter({ hasText:label }).first().click();
    };
    await command("Copy document URL");
    await expect.poll(copied).toBe(url + "/document/" + document.id);
    await command("Copy document title");
    await expect.poll(copied).toBe("Copy specification");
    await command("Copy document as Markdown");
    await expect.poll(copied).toBe("# Copy specification\n\n## Scope\n\nKeep **formatting**.");
    await page.locator("body").click({ position:{ x:900, y:600 } });
    await page.keyboard.press("ControlOrMeta+Alt+c");
    await expect.poll(copied).toBe("# Copy specification\n\n## Scope\n\nKeep **formatting**.");
  } finally {
    await app.close();
  }
});
