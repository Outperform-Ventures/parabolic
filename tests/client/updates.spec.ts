import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("project updates retain drafts, publish progress, support reactions and discussions, and save reminder schedules", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Update QA",
        email: "update-ui@example.test",
        password: "isolated-update-password",
        workspaceName: "Updates",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      create = async (kind: string, data: any) => {
        const response = await page.request.post(`${url}/api/v1/${kind}`, {
          data,
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        return response.json();
      };
    const initial = await state(),
      team = initial.teams[0],
      project = await create("projects", {
        name: "Progress reports",
        status: "started",
        leadId: initial.user.id,
        teamIds: [team.id],
      }),
      issue = await create("issues", {
        title: "Ship report",
        teamId: team.id,
        projectId: project.id,
      });
    await page.goto(`${url}/project/${project.id}`);
    await page
      .getByRole("button", { name: "Write first project update", exact: true })
      .click();
    await page
      .locator(".feature-update-compose [contenteditable=true]")
      .fill("Progress update draft survives leaving this page.");
    await page.getByRole("button", { name: "On track", exact: true }).click();
    await page.getByRole("option", { name: "At risk", exact: true }).click();
    await page.goto(`${url}/projects`);
    await expect(
      page.getByRole("button", { name: "New project", exact: true }),
    ).toBeVisible();
    await page.goto(`${url}/project/${project.id}`);
    await expect(
      page.locator(".feature-update-compose [contenteditable=true]"),
    ).toContainText("draft survives");
    await expect(page.getByRole("button", { name: "At risk", exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Submit update", exact: true })
      .click();
    await expect.poll(async () => (await state()).updates.length).toBe(1);
    await expect(page.locator("[data-update-id]")).toContainText("At risk");
    const first = (await state()).updates[0];
    expect((await state()).projects[0].lastUpdateId).toBe(first.id);
    await page
      .locator(`[data-update-id="${first.id}"]`)
      .getByRole("button", { name: "Add reaction", exact: true })
      .click();
    const emojiPicker = page.getByRole("dialog", {
      name: "Choose emoji",
      exact: true,
    });
    await expect(emojiPicker).toBeVisible();
    await emojiPicker.getByLabel("Search emoji", { exact: true }).fill("tada");
    await emojiPicker.locator('[data-emoji="tada"]').click();
    await expect
      .poll(async () => (await state()).updates[0].reactions?.["🎉"])
      .toEqual([initial.user.id]);
    await page
      .locator(`[data-update-id="${first.id}"]`)
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await page
      .locator(".update-comment-compose [contenteditable=true]")
      .fill("Can we resolve the remaining blocker?");
    await page
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).comments.filter((c: any) => c.updateId === first.id)
            .length,
      )
      .toBe(1);
    await expect(
      page.locator(".update-comment-compose [contenteditable=true]"),
    ).toHaveText("");
    await page
      .locator(".update-comment")
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    await page
      .locator(".update-comment-compose [contenteditable=true]")
      .fill("Yes, the follow-up is ready.");
    await page
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).comments.filter((c: any) => c.updateId === first.id)
            .length,
      )
      .toBe(2);
    expect(
      (await state()).comments.find((c: any) => c.body.includes("follow-up"))
        .parentId,
    ).toBeTruthy();
    await page.request.patch(`${url}/api/v1/issues/${issue.id}`, {
      data: {
        statusId: initial.statuses.find(
          (s: any) => s.teamId === team.id && s.type === "completed",
        ).id,
      },
    });
    await page.request.patch(`${url}/api/v1/projects/${project.id}`, {
      data: { targetDate: "2027-03-12" },
    });
    await page
      .getByRole("button", { name: "Write an update", exact: true })
      .click();
    await page
      .locator(".feature-update-compose [contenteditable=true]")
      .fill("Delivered the report and cleared the blocker.");
    await expect(
      page.locator(".feature-update-compose .update-progress-details"),
    ).toContainText("100%");
    await expect(
      page.locator(".feature-update-compose .update-progress-details"),
    ).toContainText("2027-03-12");
    await page
      .getByRole("button", { name: "Submit update", exact: true })
      .click();
    await expect.poll(async () => (await state()).updates.length).toBe(2);
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.locator("[data-update-id]")).toHaveCount(2);
    await page.reload();
    await expect(page.locator("[data-update-id]")).toHaveCount(2);
    await page.screenshot({
      path: "artifacts/verification/project-updates.png",
    });
    await page
      .getByRole("button", {
        name: "Notifications and update reminders",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Subscribe to issue", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", {
        name: "Unsubscribe from issue",
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByLabel("Reminder schedule", { exact: true })
      .selectOption("custom");
    await dialog.getByLabel("Update reminder frequency").selectOption("weekly");
    await dialog.getByLabel("Update reminder interval").fill("2");
    await dialog.getByLabel("Update reminder weekday").selectOption("2");
    await dialog.getByLabel("Update reminder hour").selectOption("10");
    await dialog
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect
      .poll(async () => (await state()).projects[0].updateSchedule?.interval)
      .toBe(2);
    await page.goto(`${url}/settings/project-updates`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("button", { name: "No expectation for updates", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Every week", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Every week", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wednesday", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
