import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import { createServer } from "node:http";

test("prefilled links, calendars, SLA rules, developer settings and workspace switching work through the UI", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(12_000);
  const deliveries: string[] = [];
  const receiver = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      deliveries.push(body);
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((resolve) =>
    receiver.listen(0, "127.0.0.1", resolve),
  );
  const receiverUrl = `http://127.0.0.1:${(receiver.address() as any).port}/events`;
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
    webhookAllowPrivateHosts: true,
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    expect(
      (
        await page.request.post(`${url}/auth/setup`, {
          data: {
            name: "Configuration QA",
            email: "configuration@example.test",
            password: "isolated-config-password",
            workspaceName: "Original workspace",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    await page.goto(
      `${url}/team/ENG/new?title=Prefilled+issue&priority=high&status=Todo&assignee=Configuration+QA&estimate=3`,
    );
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Prefilled issue",
    );
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect.poll(async () => (await state()).issues.length).toBe(1);
    const issue = (await state()).issues[0];
    expect(issue.priority).toBe(2);
    expect(issue.assigneeId).toBe((await state()).user.id);
    await page.goto(`${url}/issues/${issue.id}`);
    await page
      .getByRole("button", { name: "Issue options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: /^Due date/ }).click();
    await page.getByRole("menuitem", { name: "Custom…", exact: true }).click();
    const calendar = page.getByRole("dialog", { name: "Set due date", exact: true });
    await calendar.getByLabel("Due date", { exact: true }).fill("in 2 weeks");
    await calendar.getByRole("button", { name: "Save due date", exact: true }).click();
    await expect
      .poll(async () => Boolean((await state()).issues[0].dueDate))
      .toBe(true);
    await page
      .getByRole("button", { name: "Issue options", exact: true })
      .click();
    const issueOptions = page.locator(".issue-action-filter").first();
    await issueOptions.getByRole("searchbox").fill("Set SLA");
    await issueOptions
      .getByRole("menuitem", { name: "Set SLA", exact: true })
      .click();
    await page.getByLabel("SLA duration").fill("2");
    await page.getByLabel("SLA unit").selectOption("businessDay");
    await page.getByRole("button", { name: "Apply SLA", exact: true }).click();
    await expect
      .poll(async () => (await state()).issues[0].slaDuration?.unit)
      .toBe("businessDay");
    expect((await state()).issues[0].dueDate).toBeNull();
    await expect(page.locator(".sla-indicator")).toBeVisible();
    await page.goto(`${url}/settings/slas`);
    await page
      .getByRole("button", { name: "Use default rules", exact: true })
      .click();
    await expect.poll(async () => (await state()).slaPolicies.length).toBe(3);
    await page.getByLabel("Business days").selectOption("sun-thu");
    await expect
      .poll(async () => (await state()).workspaces[0].workWeek)
      .toBe("sun-thu");
    await page.request.patch(`${url}/api/v1/issues/${issue.id}`, {
      data: { priority: 0 },
    });
    await expect
      .poll(async () => (await state()).issues[0].slaDueAt)
      .toBeNull();
    await page.goto(`${url}/settings/webhooks`);
    await page
      .getByRole("button", { name: "New webhook", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Endpoint URL").fill(receiverUrl);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Credential", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Send test", exact: true }).click();
    await expect
      .poll(() => deliveries.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Events (comma-separated)").fill("issues.update");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".feature-settings-card")).toContainText(
      "issues.update",
    );
    await page.goto(`${url}/settings/applications?manage=1`);
    await page
      .getByRole("button", { name: "New application", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Application name").fill("Internal client");
    await dialog
      .getByLabel("Redirect URLs (one per line)")
      .fill(`${url}/callback`);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Credential", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Application name").fill("Renamed internal client");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect
      .poll(async () => {
        const applications = await (
          await page.request.get(`${url}/api/v1/apps`)
        ).json();
        return applications.nodes?.[0]?.name;
      })
      .toBe("Renamed internal client");
    await page.goto(`${url}/my-issues`);
    await page
      .getByRole("button", { name: / Workspace Menu$/ })
      .click();
    await page.getByRole("menuitem", { name: "Switch workspace O then W", exact: true }).click();
    await page
      .getByRole("menuitem", {
        name: "Create or join a workspace…",
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Workspace name").fill("Second workspace");
    await dialog
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: / Workspace Menu$/ }),
    ).toContainText("Second workspace");
    expect((await state()).issues).toHaveLength(0);
    await page
      .getByRole("button", { name: / Workspace Menu$/ })
      .click();
    await page.getByRole("menuitem", { name: "Switch workspace O then W", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Original workspace", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await state()).issues.some((i: any) => i.id === issue.id),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  }
});
