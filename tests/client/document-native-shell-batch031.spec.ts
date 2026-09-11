import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("document detail uses the native shell, menus, and slash-command order", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: { name: "Document owner", email: "document-shell@example.test", password: "document-password" },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const document = await (
      await page.request.post(url + "/api/v1/documents", {
        data: {
          title: "Native document shell",
          content: "<p>Document body</p>",
          visibility: "workspace",
          teamId: state.teams[0].id,
        },
      })
    ).json();

    await page.goto(url + "/document/" + document.id);
    await expect(page.locator(".document-native-breadcrumbs")).toContainText(state.teams[0].name);
    await expect(page.locator(".feature-document-native-shell > .feature-document")).toHaveCSS("width", "800px");
    await expect(page.getByText("Comments 0", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add to favorites", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Document options", exact: true }).click();
    const actions = page.getByRole("menu");
    for (const label of ["Move to", "Pin to team", "Duplicate", "Rename…", "Favorite", "Copy", "Remind me", "Show author names", "Show document history", "Delete"])
      await expect(actions.getByRole("menuitem", { name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Document display options and metadata/ }).click();
    await expect(page.getByText("Show comments", { exact: true })).toBeVisible();
    await expect(page.getByText("Show author names", { exact: true })).toBeVisible();
    await expect(page.getByText("Owned by", { exact: true })).toBeVisible();
    await expect(page.getByText("Last edit by", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    const editor = page.getByRole("textbox", { name: "Start writing, or type / for commands…", exact: true });
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("/");
    const slash = page.getByRole("listbox", { name: "Insert block", exact: true });
    const first = await slash.getByRole("option").evaluateAll((items) => items.slice(0, 13).map((item) => item.querySelector("span")?.textContent?.trim()));
    expect(first).toEqual([
      "Heading 1", "Heading 2", "Heading 3", "Bulleted list", "Numbered list", "Checklist",
      "Insert media…", "Insert gif…", "Attach files…", "Code block", "Diagram", "Collapsible section", "Blockquote",
    ]);
  } finally {
    await app.close();
  }
});

test("document native actions remain functional and persistent", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: { name: "Action owner", email: "document-actions@example.test", password: "document-password" },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json();
    const document = await (
      await page.request.post(url + "/api/v1/documents", {
        data: { title: "Action document", content: "<p>Body</p>", visibility: "workspace", teamId: state.teams[0].id },
      })
    ).json();
    const route = url + "/document/" + document.id;
    await page.goto(route);

    await page.getByRole("button", { name: "Add to favorites", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove from favorites", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove from favorites", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove from favorites", exact: true }).click();

    await page.getByRole("button", { name: "Document options", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Filter document actions", exact: true })).toBeFocused();
    await expect(page.getByRole("status")).toHaveText("Showing all items");
    await page.getByRole("menuitem", { name: /^Rename…/ }).click();
    await expect(page.getByRole("textbox", { name: "Document title", exact: true })).toBeFocused();

    await page.getByRole("button", { name: "Document options", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Move to/ }).click();
    await expect(page.getByRole("dialog", { name: "Move document", exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "Move document", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: /Document display options and metadata/ }).click();
    await page.getByRole("button", { name: "Show document history", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Restore version for Action document", exact: true })).toBeVisible();
    await page.goto(route);

    await page.getByRole("button", { name: "Document options", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Duplicate/ }).click();
    await expect(page).not.toHaveURL(route);
    await expect(page.getByRole("textbox", { name: "Document title", exact: true })).toHaveValue("Action document (copy)");

    await page.goto(route);
    await page.getByRole("button", { name: "Document options", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Delete/ }).click();
    await expect(page.getByRole("dialog", { name: "Delete Action document?", exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("Show comments controls inline document threads and comment actions", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: { name: "Comment owner", email: "document-comments@example.test", password: "document-password" },
    });
    const document = await (
      await page.request.post(url + "/api/v1/documents", {
        data: { title: "Comment visibility", content: "<p>Review this selected text.</p>", visibility: "workspace" },
      })
    ).json();
    await page.goto(url + "/document/" + document.id);
    const editor = page.getByRole("textbox", { name: "Start writing, or type / for commands…", exact: true });
    await editor.locator("p").evaluate((element) => {
      const range = window.document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      (element.closest('[contenteditable="true"]') as HTMLElement).focus();
      window.document.dispatchEvent(new Event("selectionchange"));
    });
    await page.getByRole("button", { name: "Comment on selection", exact: true }).click();
    await page.getByRole("textbox", { name: "Comment on selected text…", exact: true }).fill("Keep this visible.");
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(editor.locator(".editor-comment-anchor")).toHaveCount(1);
    await page.getByRole("button", { name: /Document display options and metadata/ }).click();
    await page.getByText("Show comments", { exact: true }).locator("..").getByRole("checkbox").evaluate((input: HTMLInputElement) => input.click());
    await expect(editor.locator(".editor-comment-anchor")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Comment on selection", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Document display options and metadata/ }).click();
    await page.getByText("Show comments", { exact: true }).locator("..").getByRole("checkbox").evaluate((input: HTMLInputElement) => input.click());
    await expect(editor.locator(".editor-comment-anchor")).toHaveCount(1);
  } finally {
    await app.close();
  }
});
