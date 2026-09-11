import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("issue editing, drafts, selection, comments, and offline changes survive real navigation and reload", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const app = createApp({
    databasePath: ":memory:",
    host: "127.0.0.1",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url: base } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const setup = await page.request.post(`${base}/auth/setup`, {
      data: {
        name: "Issue QA",
        email: "issue-qa@example.test",
        password: "isolated-test-password",
        workspaceName: "Workspace",
      },
    });
    expect(setup.ok()).toBeTruthy();
    const state = async () =>
      (await page.request.get(`${base}/api/v1/state`)).json();
    const initial = await state(),
      team = initial.teams[0];
    await page.goto(`${base}/team/${team.id}/all`);
    await page
      .getByRole("button", { name: "Create new issue", exact: true })
      .click();
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Recover this draft");
    await page
      .locator(".issue-composer .tiptap")
      .fill("Draft description retained after reload.");
    // Complete the reload's account probe before the next full navigation.
    // WebKit can report an aborted probe as an access-control page error.
    const reloadedAccount = page.waitForResponse(response =>
      response.url() === `${base}/auth/status` && response.status() === 200,
    );
    await page.reload();
    await reloadedAccount;
    await page.goto(`${base}/drafts`);
    await expect(
      page.getByRole("button", { name: /^Recover this draft/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Recover this draft/ }).click();
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Recover this draft",
    );
    await expect(page.locator(".issue-composer .tiptap")).toContainText(
      "retained after reload",
    );
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await state()).issues.some(
          (i: any) => i.title === "Recover this draft",
        ),
      )
      .toBe(true);
    const issue = (await state()).issues.find(
      (i: any) => i.title === "Recover this draft",
    );
    await expect(
      page.getByText("No active drafts", { exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/issues/${issue.id}`);
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Last keystroke survives navigation");
    await page.getByRole("link", { name: "My issues", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id).title,
      )
      .toBe("Last keystroke survives navigation");
    await page.goto(`${base}/issues/${issue.id}`);
    await page
      .locator(".issue-article>.rich-editor .tiptap")
      .fill("Description saved when leaving immediately.");
    await page
      .getByRole("link", { name: "Projects", exact: true })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id)
            .description,
      )
      .toContain("leaving immediately");
    await page.goto(`${base}/issues/${issue.id}`);
    await expect(
      page.locator(".issue-article>.rich-editor .tiptap"),
    ).toContainText("Description saved when leaving immediately.");
    await page.locator(".comment-composer .tiptap").fill("Review complete");
    await page.locator(".comment-composer .tiptap").press("Enter");
    await expect(page.locator(".comment")).toContainText("Review complete");
    await expect
      .poll(async () =>
        (await state()).comments.some((c: any) =>
          c.body.includes("Review complete"),
        ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Change priority", exact: true })
      .click();
    await page.getByRole("button", { name: "High", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id).priority,
      )
      .toBe(2);
    await page.screenshot({ path: "artifacts/client-ui/issue-detail.png" });
    await context.setOffline(true);
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Saved while offline");
    await page.getByRole("link", { name: "My issues", exact: true }).click();
    await expect(page.locator(".sync-indicator").first()).toContainText(
      /Offline|change|sync/i,
    );
    await context.setOffline(false);
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id).title,
        { timeout: 15_000 },
      )
      .toBe("Saved while offline");
    const extra = await page.request.post(`${base}/api/v1/issues`, {
      data: { title: "Second issue for selection", teamId: team.id },
    });
    expect(extra.ok()).toBeTruthy();
    await page.goto(`${base}/team/${team.id}/all`);
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    await page.getByTestId("issue-row").first().click({ button: "right" });
    await expect(
      page.getByRole("menuitem", { name: "Make a copy", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Archive", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await page.locator(".row-checkbox").nth(0).click();
    await page.locator(".row-checkbox").nth(1).click();
    await page
      .getByRole("button", { name: "Bulk issue actions", exact: true })
      .click();
    await expect(page.getByRole("menuitem", { name: "Archive 2 issues", exact: true })).toHaveCount(0);
    await page
      .getByRole("menuitem", { name: "Delete 2 issues", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Delete 2 issues?" }).getByRole("button", { name: "Delete issues", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await state()).issues.filter((i: any) => !i.deletedAt).length,
      )
      .toBe(0);
    // A multi-selection is one undoable action, including after server acknowledgement.
    await page.locator("body").click({ position: { x: 700, y: 500 } });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(async () => (await state()).issues.filter((i: any) => !i.deletedAt).length).toBe(2);
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    await page.reload();
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await app.close();
  }
});
