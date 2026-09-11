import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("private issue sharing exposes a safe editable subtree and removes access live after revocation", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const context = await browser.newContext({
      viewport: { width: 1777, height: 991 },
    }),
    recipient = await context.newPage();
  recipient.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  recipient.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Team owner",
        email: "sharing-owner@example.test",
        password: "isolated-sharing-owner",
        workspaceName: "Sharing",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      recipientState = async () =>
        (await recipient.request.get(`${url}/api/v1/state`)).json();
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const invite = await create("invitations", {
      email: "sharing-member@example.test",
    });
    const joined = await (
      await recipient.request.post(`${url}/auth/join`, {
        data: {
          token: invite.token,
          name: "Shared colleague",
          password: "isolated-sharing-member",
        },
      })
    ).json();
    const team = await create("teams", {
        name: "Private planning",
        key: "HIDE",
        visibility: "private",
        initializeWorkflow: false,
        issueSharingEnabled: true,
      }),
      project = await create("projects", {
        name: "Confidential project",
        teamIds: [team.id],
      });
    const projectLabel = await create("labels", {
      name: "Private project classification",
      entityType: "projects",
      teamId: team.id,
    });
    const issueLabel = await create("labels", {
      name: "Shared issue classification",
      entityType: "issues",
      teamId: team.id,
    });
    expect(
      (
        await page.request.patch(`${url}/api/v1/projects/${project.id}`, {
          data: { labelIds: [projectLabel.id] },
        })
      ).ok(),
    ).toBeTruthy();
    const todo = await create("statuses", {
        name: "Todo",
        type: "unstarted",
        teamId: team.id,
        color: "#8d8d99",
        position: 1,
      }),
      done = await create("statuses", {
        name: "Done",
        type: "completed",
        teamId: team.id,
        color: "#5e6ad2",
        position: 2,
      });
    const parent = await create("issues", {
        title: "Shared planning item",
        teamId: team.id,
        statusId: todo.id,
        projectId: project.id,
      }),
      child = await create("issues", {
        title: "Shared child item",
        parentId: parent.id,
        teamId: team.id,
        statusId: todo.id,
      });
    await page.goto(`${url}/issues/${parent.id}`);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Share with Shared colleague")
      .check();
    await page
      .getByRole("button", { name: "Save access", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === parent.id)
            .sharedWithIds,
      )
      .toEqual([joined.user.id]);
    await expect(page.locator(".shared-issue-banner")).toContainText(
      "Shared colleague",
    );
    await recipient.goto(`${url}/my-issues?tab=Shared`);
    await expect(recipient.getByTestId("issue-row")).toHaveCount(2);
    await recipient
      .getByTestId("issue-row")
      .filter({ hasText: "Shared planning item" })
      .click();
    await expect(recipient.locator(".shared-issue-banner")).toContainText(
      "shared with you",
    );
    await expect(
      recipient.locator(".issue-properties-panel"),
    ).not.toContainText("Confidential project");
    await expect(
      recipient.getByRole("button", { name: "Change project", exact: true }),
    ).toHaveCount(0);
    await expect(recipient.locator(".page-header")).not.toContainText(
      "Private planning",
    );
    await recipient
      .locator(".issue-properties-panel")
      .getByRole("button", { name: "Change status", exact: true })
      .click();
    await recipient
      .locator(".property-menu")
      .getByRole("button", { name: done.name, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === parent.id).statusId,
      )
      .toBe(done.id);
    await recipient
      .getByLabel("Issue title", { exact: true })
      .fill("Shared colleague edited this");
    await recipient.getByLabel("Issue title", { exact: true }).blur();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === parent.id).title,
      )
      .toBe("Shared colleague edited this");
    await recipient
      .locator(".comment-composer [contenteditable=true]")
      .fill("This edit is visible to the team.");
    await recipient
      .getByRole("button", { name: "Submit comment", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).comments.filter((c: any) => c.issueId === parent.id)
            .length,
      )
      .toBe(1);
    await recipient
      .getByRole("button", { name: "Subscribe to issue", exact: true })
      .click();
    await expect(
      recipient.getByRole("button", {
        name: "Unsubscribe from issue",
        exact: true,
      }),
    ).toBeVisible();
    await recipient.screenshot({
      path: "artifacts/verification/shared-issue.png",
    });
    const safe = await recipientState();
    expect(JSON.stringify(safe)).not.toContain(projectLabel.name);
    expect(
      safe.issues
        .find((i: any) => i.id === parent.id)
        .sharedLabels.map((l: any) => l.id),
    ).toContain(issueLabel.id);
    expect(safe.teams.some((t: any) => t.id === team.id)).toBe(false);
    expect(safe.projects.some((p: any) => p.id === project.id)).toBe(false);
    expect(safe.issues.find((i: any) => i.id === parent.id).teamId).toBeNull();
    expect(safe.issues.find((i: any) => i.id === child.id).sharedAccess).toBe(
      true,
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Share with Shared colleague")
      .uncheck();
    await page
      .getByRole("button", { name: "Save access", exact: true })
      .click();
    await expect
      .poll(async () => (await recipientState()).issues.length)
      .toBe(0);
    await expect(
      recipient.getByLabel("Issue title", { exact: true }),
    ).toHaveCount(0);
    await expect(
      recipient.getByText("Issue not found", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await recipient.close();
    await context.close();
    await page.close();
    await app.close();
  }
});
