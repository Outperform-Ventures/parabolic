import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

async function fixture(page: import("@playwright/test").Page, suffix: string) {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve(process.env.PARABOLIC_AUDIT_STATIC_DIR || "dist"),
  });
  const { url } = await app.start();
  await page.request.post(url + "/auth/setup", {
    data: { name: "Customer parity owner", email: `customer-parity-${suffix}@example.test`, password: "customer-parity-password" },
  });
  const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
  const customer = await page.request.post(url + "/api/v1/customers", { data: { name: "Acme" } }).then((response) => response.json());
  return { app, url, state, customer };
}

test("customer request Display options match the captured controls and persist", async ({ page }) => {
  const f = await fixture(page, "display");
  try {
    const issue = await page.request.post(f.url + "/api/v1/issues", { data: { title: "Display target", teamId: f.state.teams[0].id, priority: 2 } }).then((response) => response.json());
    await page.request.post(f.url + "/api/v1/requests", { data: { title: "Display request", customerId: f.customer.id, issueId: issue.id } });
    await page.goto(f.url + "/customer/" + f.customer.id);
    await page.getByRole("button", { name: "Display options", exact: true }).click();
    const display = page.locator(".customer-request-display");
    await expect(display.getByRole("combobox", { name: "Request grouping" })).toContainText("None");
    await expect(display.getByRole("combobox", { name: "Request ordering" })).toContainText("Created date");
    await expect(display.getByRole("combobox", { name: "Completed requests" })).toContainText("All");
    await expect(display.getByLabel("Show important first", { exact: true })).toBeChecked();
    for (const label of ["ID", "Priority", "Status", "Target/Due date"])
      await expect(display.getByLabel("Show " + label, { exact: true })).toBeChecked();
    await display.getByLabel("Show ID", { exact: true }).uncheck();
    await expect(page.locator(".customer-request-row-properties")).not.toContainText(issue.identifier);
    await page.reload();
    await expect(page.locator(".customer-request-row-properties")).not.toContainText(issue.identifier);
  } finally {
    await page.close();
    await f.app.close();
  }
});

test("request row menu exposes the native nine-action inventory and functional issue creation", async ({ page }) => {
  const f = await fixture(page, "menu");
  try {
    const request = await page.request.post(f.url + "/api/v1/requests", { data: { title: "Unlinked request", customerId: f.customer.id } }).then((response) => response.json());
    await page.goto(f.url + "/customer/" + f.customer.id);
    const row = page.locator(`[data-request-id="${request.id}"]`);
    await row.getByRole("button", { name: "Open menu", exact: true }).click();
    const menu = page.locator(".customer-request-row-menu");
    await expect(menu).toBeVisible();
    const labels = (await menu.getByRole("menuitem").allTextContents()).map((value) => value.trim());
    expect(labels).toEqual([
      "Mark as important", "Move to", "Copy link", "Create issue from request…", "Edit request",
      "New request on issue", "Change customer…", "Open issue", "Delete",
    ]);
    await menu.getByRole("menuitem", { name: "Create issue from request…", exact: true }).click();
    await expect(row.getByRole("link", { name: "Open issue", exact: true })).toBeVisible();
    const state = await page.request.get(f.url + "/api/v1/state").then((response) => response.json());
    const linked = state.requests.find((item: any) => item.id === request.id);
    expect(linked.issueId).toBeTruthy();
    expect(state.issues.some((item: any) => item.id === linked.issueId && item.title === request.title)).toBeTruthy();
  } finally {
    await page.close();
    await f.app.close();
  }
});

test("Add customer request uses the native inline new-issue composer and persists atomically", async ({ page }) => {
  const f = await fixture(page, "composer");
  try {
    await page.goto(f.url + "/customer/" + f.customer.id);
    await page.getByRole("button", { name: "Add customer request", exact: true }).click();
    const composer = page.locator(".issue-request-composer");
    await expect(composer).toBeVisible();
    await expect(composer).toContainText("New issue");
    await expect(composer).toContainText("Customer request from Acme");
    await expect(composer.getByRole("button", { name: "Edit new issue title", exact: true })).toBeVisible();
    await expect(composer.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
    await expect(composer.getByRole("button", { name: "Add request", exact: true })).toBeDisabled();
    await composer.locator('[contenteditable="true"]').fill("Please add audit exports");
    await composer.getByRole("button", { name: "Add request", exact: true }).click();
    await expect(composer).toHaveCount(0);
    const state = await page.request.get(f.url + "/api/v1/state").then((response) => response.json());
    expect(state.requests).toHaveLength(1);
    expect(state.issues).toHaveLength(1);
    expect(state.requests[0].issueId).toBe(state.issues[0].id);
    expect(state.requests[0].customerId).toBe(f.customer.id);
  } finally {
    await page.close();
    await f.app.close();
  }
});
