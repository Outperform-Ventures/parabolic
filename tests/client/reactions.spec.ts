import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ZkAAAAASUVORK5CYII=",
  "base64",
);
test("custom emoji upload drives issue and comment reactions and deletion preserves history while removing picker choices", async ({
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
        name: "Reaction owner",
        email: "reactions@example.test",
        password: "isolated-reaction-test",
        workspaceName: "Reactions",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      initial = await state();
    const issue = await (
      await page.request.post(url + "/api/v1/issues", {
        data: { title: "Emoji feedback", teamId: initial.teams[0].id },
      })
    ).json();
    const comment = await (
      await page.request.post(url + "/api/v1/comments", {
        data: { issueId: issue.id, body: "<p>React to this message.</p>" },
      })
    ).json();
    await page.goto(url + "/settings/emojis");
    await page.locator('input[type="file"]').setInputFiles({
      name: "launch.png",
      mimeType: "image/png",
      buffer: png,
    });
    const form = page.getByRole("dialog", { name: "Add emoji", exact: true });
    await form
      .getByPlaceholder("Emoji name", { exact: true })
      .fill("team_launch");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(
      page.getByText(":team_launch:", { exact: true }),
    ).toBeVisible();
    const custom = (await state()).workspaces[0].customEmojis.find(
      (emoji: any) => emoji.name === "team_launch",
    );
    expect(custom).toBeTruthy();
    expect(await (await page.request.get(url + custom.url)).body()).toEqual(
      png,
    );
    await page.goto(url + "/issues/" + issue.id);
    await page
      .getByLabel("Issue reactions")
      .getByRole("button", { name: "Add reaction", exact: true })
      .click();
    let picker = page.getByRole("dialog", {
      name: "Choose emoji",
      exact: true,
    });
    await picker
      .getByLabel("Search emoji", { exact: true })
      .fill("team_launch");
    await picker
      .getByRole("button", { name: "team_launch", exact: true })
      .click();
    await expect(picker).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await state()).issues.find((row: any) => row.id === issue.id)
            .reactions,
      )
      .toEqual({ [`custom:${custom.id}`]: [initial.user.id] });
    await expect(
      page.getByLabel("Issue reactions").locator("img"),
    ).toHaveAttribute("src", custom.url);
    await page
      .locator(".comment-reactions")
      .getByRole("button", { name: "Add reaction", exact: true })
      .click();
    picker = page.getByRole("dialog", { name: "Choose emoji", exact: true });
    await picker.getByLabel("Search emoji", { exact: true }).fill("otter");
    await picker.getByRole("button", { name: "otter", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await state()).comments.find((row: any) => row.id === comment.id)
            .reactions?.["🦦"],
      )
      .toEqual([initial.user.id]);
    await page.goto(url + "/settings/emojis");
    await page
      .getByRole("button", { name: "Delete team_launch emoji", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete emoji", exact: true })
      .getByRole("button", { name: "Delete emoji", exact: true })
      .click();
    await expect(page.getByText("No emojis", { exact: true })).toBeVisible();
    await page.goto(url + "/issues/" + issue.id);
    await expect(
      page.getByLabel("Issue reactions").locator("img"),
    ).toHaveAttribute("src", custom.url);
    await expect(
      page.getByLabel("Issue reactions").locator("img"),
    ).toBeVisible();
    await page
      .getByLabel("Issue reactions")
      .getByRole("button", { name: "Add reaction", exact: true })
      .click();
    picker = page.getByRole("dialog", { name: "Choose emoji", exact: true });
    await picker
      .getByLabel("Search emoji", { exact: true })
      .fill("team_launch");
    await expect(
      picker.getByRole("button", { name: "team_launch", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page
      .getByLabel("Issue reactions")
      .getByRole("button", { name: `React custom:${custom.id}`, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((row: any) => row.id === issue.id)
            .reactions,
      )
      .toEqual({ [`custom:${custom.id}`]: [] });
    await page.screenshot({
      path: "artifacts/verification/issue-reactions.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
