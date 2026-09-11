import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("a rejected issue retains its contents through reload and can be corrected as a draft", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Recovery QA",
        email: "recovery@example.test",
        password: "isolated-recovery-password",
        workspaceName: "Recovery",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const project = await (
      await page.request.post(`${url}/api/v1/projects`, {
        data: {
          name: "Removed while drafting",
          teamIds: [initial.teams[0].id],
        },
      })
    ).json();
    await page.goto(`${url}/team/${initial.teams[0].id}/all`);
    await page
      .getByRole("button", { name: "Create new issue", exact: true })
      .click();
    await page.getByLabel("Issue title", { exact: true }).fill("Keep my work");
    await page
      .locator(".issue-composer .tiptap")
      .fill("Important description that must not disappear.");
    await page
      .getByRole("button", { name: "Change project", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Removed while drafting", exact: true })
      .click();
    expect(
      (await page.request.delete(`${url}/api/v1/projects/${project.id}`)).ok(),
    ).toBeTruthy();
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Review unsent changes", exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Review unsent changes", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Review unsent change", exact: true }),
    ).toContainText("Important description that must not disappear.");
    await page
      .getByRole("button", { name: "Reopen as draft", exact: true })
      .click();
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Keep my work",
    );
    await page
      .getByRole("button", { name: "Change project", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "No project", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.filter((i: any) => !i.deletedAt).length,
      )
      .toBe(1);
    const issue = (await state()).issues.find((i: any) => !i.deletedAt);
    expect(issue.description).toContain("must not disappear");
    expect(issue.projectId).toBeNull();
    await expect(
      page.getByRole("button", { name: "Review unsent changes", exact: true }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});
