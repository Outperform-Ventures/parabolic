import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("shared recipients use scoped property and subscription shortcuts and the share command preserves permissions", async ({
  page,
  browser,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  // page.route cannot gate requests taken over by a Service Worker; offline behavior has separate coverage.
  const context = await browser.newContext({ serviceWorkers: "block" }),
    recipient = await context.newPage();
  const errors: string[] = [];
  recipient.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Shortcut owner",
        email: "shortcut-owner@example.test",
        password: "Shortcut-owner-password",
        workspaceName: "Shared shortcuts",
      },
    });
    const state = await (await page.request.get(`${url}/api/v1/state`)).json();
    const invitation = await (
      await page.request.post(`${url}/api/v1/invitations`, {
        data: { email: "shortcut-guest@example.test", role: "guest" },
      })
    ).json();
    const joined = await (
      await context.request.post(`${url}/auth/join`, {
        data: {
          token: invitation.token,
          name: "Shared guest",
          email: "shortcut-guest@example.test",
          password: "Shared-guest-password",
        },
      })
    ).json();
    const create = async (kind: string, data: Record<string, unknown>) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const team = await create("teams", {
      name: "Private source team",
      key: "SCT",
      private: true,
      memberIds: [state.user.id],
      issueSharingEnabled: true,
      estimateScale: "Exponential",
      zeroEstimate: false,
    });
    const todo = await create("statuses", {
        name: "Shared Todo",
        type: "unstarted",
        teamId: team.id,
        color: "#aaa",
      }),
      done = await create("statuses", {
        name: "Shared Done",
        type: "completed",
        teamId: team.id,
        color: "#5e6ad2",
      }),
      label = await create("labels", {
        name: "Shared delivery label",
        teamId: team.id,
        color: "#f2994a",
      });
    const issue = await create("issues", {
      title: "Shared shortcut issue",
      description:
        '<p><strong>Important</strong> <a href="https://example.test/reference">reference</a></p>',
      teamId: team.id,
      statusId: todo.id,
      sharedWithIds: [joined.user.id],
    });
    const saved = async () =>
      await (await page.request.get(`${url}/api/v1/issues/${issue.id}`)).json();
    await recipient.goto(`${url}/issues/${issue.id}`);
    await expect(
      recipient.getByText("This issue has been shared with you.", {
        exact: true,
      }),
    ).toBeVisible();
    const mod = await recipient.evaluate(() =>
      /Mac/.test(navigator.platform) ? "Meta" : "Control",
    );
    const blur = () =>
      recipient.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await blur();
    await recipient.keyboard.press("s");
    let dialog = recipient.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Shared Done", exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Shared Done", exact: true })
      .click();
    await expect.poll(async () => (await saved()).statusId).toBe(done.id);
    await blur();
    await recipient.keyboard.press("Shift+e");
    dialog = recipient.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "8", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "0", exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "8", exact: true }).click();
    await expect.poll(async () => (await saved()).estimate).toBe(8);
    await blur();
    await recipient.keyboard.press("l");
    dialog = recipient.getByRole("dialog");
    await dialog.getByLabel("Shared delivery label", { exact: true }).check();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await saved()).labelIds).toContain(label.id);
    // Hold the first write so the second toggle must recognize the optimistic record.
    let releaseSubscription!: () => void;
    const subscriptionGate = new Promise<void>((resolve) => {
        releaseSubscription = resolve;
      }),
      subscriptionWrites: string[] = [];
    await recipient.route("**/api/v1/batch", async (route) => {
      const operations =
        route
          .request()
          .postDataJSON()
          ?.operations?.filter(
            (operation: any) => operation.kind === "subscriptions",
          ) ?? [];
      if (operations.length) {
        subscriptionWrites.push(
          ...operations.map((operation: any) => operation.action),
        );
        await subscriptionGate;
      }
      await route.continue();
    });
    try {
      await blur();
      await recipient.keyboard.press("Shift+s");
      await expect(
        recipient
          .locator(".activity-heading")
          .getByRole("button", { name: "Unsubscribe from issue", exact: true }),
      ).toBeVisible();
      await recipient.keyboard.press("Shift+s");
      await expect(
        recipient
          .locator(".activity-heading")
          .getByRole("button", { name: "Subscribe to issue", exact: true }),
      ).toBeVisible();
    } finally {
      releaseSubscription();
    }
    await expect.poll(() => subscriptionWrites).toEqual(["create", "delete"]);
    await expect
      .poll(async () => {
        const data = await (
          await context.request.get(`${url}/api/v1/state`)
        ).json();
        return data.subscriptions.filter(
          (record: any) =>
            record.userId === joined.user.id &&
            record.entityId === issue.id &&
            !record.deletedAt,
        ).length;
      })
      .toBe(0);
    await expect(
      recipient
        .locator(".activity-heading")
        .getByRole("button", { name: "Subscribe to issue", exact: true }),
    ).toBeVisible();
    await recipient.unroute("**/api/v1/batch");
    await recipient.keyboard.press("Shift+p");
    await expect(recipient.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => (await saved()).teamId).toBe(team.id);
    await recipient.keyboard.press(`${mod}+Backspace`);
    await expect(recipient.getByRole("dialog")).toHaveCount(0);
    expect((await saved()).deletedAt).toBeFalsy();
    await recipient.keyboard.press(`${mod}+k`);
    await recipient
      .getByRole("textbox", { name: "Command menu", exact: true })
      .fill("Share issue");
    await recipient
      .getByRole("option", { name: "Share issue", exact: true })
      .click();
    dialog = recipient.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Share issue", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Save access", exact: true }),
    ).toHaveCount(0);
    await recipient.keyboard.press("Escape");
    await recipient.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__shortcutClipboard = text;
          },
        },
      });
    });
    await blur();
    await recipient.keyboard.press(`${mod}+Alt+c`);
    await expect
      .poll(() => recipient.evaluate(() => (window as any).__shortcutClipboard))
      .toContain("**Important** [reference](https://example.test/reference)");
    expect(errors).toEqual([]);
  } finally {
    await recipient.close();
    await context.close();
    await page.close();
    await app.close();
  }
});

test("team shortcuts honor inherited estimate settings and ancestor issue labels", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Team keyboard",
        email: "team-keyboard@example.test",
        password: "Team-keyboard-password",
      },
    });
    const create = async (kind: string, data: Record<string, unknown>) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const parent = await create("teams", {
        name: "Estimate parent",
        key: "EPT",
        estimateScale: "Exponential",
        zeroEstimate: false,
        extendedEstimates: false,
      }),
      team = await create("teams", {
        name: "Estimate child",
        key: "ECT",
        parentId: parent.id,
        inheritEstimates: true,
      }),
      other = await create("teams", { name: "Unrelated team", key: "EOT" });
    const inherited = await create("labels", {
        name: "Inherited issue label",
        teamId: parent.id,
      }),
      unrelated = await create("labels", {
        name: "Unrelated issue label",
        teamId: other.id,
      }),
      projectLabel = await create("labels", {
        name: "Project-only label",
        teamId: parent.id,
        entityType: "projects",
      }),
      issue = await create("issues", {
        title: "Inherited shortcut choices",
        teamId: team.id,
      });
    await page.goto(`${url}/issues/${issue.id}`);
    await expect(page.locator(".issue-detail-view")).toBeVisible();
    const blur = () =>
      page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await blur();
    await page.keyboard.press("Shift+e");
    let dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "16", exact: true }),
    ).toBeVisible();
    for (const value of ["0", "13", "32"])
      await expect(
        dialog.getByRole("button", { name: value, exact: true }),
      ).toHaveCount(0);
    await dialog.getByRole("button", { name: "16", exact: true }).click();
    const saved = async () =>
      await (await page.request.get(`${url}/api/v1/issues/${issue.id}`)).json();
    await expect.poll(async () => (await saved()).estimate).toBe(16);
    await blur();
    await page.keyboard.press("l");
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel(inherited.name, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel(unrelated.name, { exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByLabel(projectLabel.name, { exact: true }),
    ).toHaveCount(0);
    await dialog.getByLabel(inherited.name, { exact: true }).check();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await saved()).labelIds)
      .toContain(inherited.id);
  } finally {
    await page.close();
    await app.close();
  }
});
