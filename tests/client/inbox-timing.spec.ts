import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

async function fixture(page: Page, name: string, inbox: Record<string, unknown>) {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  // These cases must observe the client deadline before the minute worker materializes it.
  app.scheduler.close();
  const setup = await page.request.post(`${url}/auth/setup`, { data: {
    name, email: `${name}@example.test`, password: "isolated-inbox-timing-password", workspaceName: name,
  } });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const state = async () => (await page.request.get(`${url}/api/v1/state`)).json();
  const initial = await state();
  const create = async (kind: string, data: unknown) => {
    const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const patch = async (kind: string, id: string, data: unknown) => {
    const response = await page.request.patch(`${url}/api/v1/${kind}/${id}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  await patch("users", initial.user.id, { preferences: { inbox: { priorityEnabled: false, badgeCount: "all", ...inbox } } });
  return { app, url, state, initial, create, patch };
}

test("a previously read snoozed row wakes unread at expiry and preserves an explicit later read through rerenders", async ({ page }) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(12_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  const f = await fixture(page, "inbox-expiry-browser", { showSnoozed: true, groupBy: "focus" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const issue = await f.create("issues", { title: "Read before the wake deadline", teamId: f.initial.teams[0].id });
    const notification = await f.create("notifications", {
      type: "assigned", title: issue.title, issueId: issue.id, snoozedUntil: new Date(Date.now() + 120_000).toISOString(),
    });
    const record = async () => (await f.state()).notifications.find((item: any) => item.id === notification.id);
    await page.goto(`${f.url}/inbox`);
    const row = page.locator(`[data-notification-id="${notification.id}"]`);
    const badge = page.getByRole("link", { name: "Inbox", exact: true }).locator(".sidebar-count");
    await expect(row).toBeVisible();
    await row.click();
    await expect.poll(async () => !!(await record()).readAt).toBe(true);
    await expect(row).not.toHaveClass(/unread/);
    const deadline = Date.now() + 10_000;
    await f.patch("notifications", notification.id, { snoozedUntil: new Date(deadline).toISOString() });
    const earlierRead = (await record()).readAt;
    expect(Date.parse(earlierRead)).toBeLessThan(deadline);
    await page.getByRole("button", { name: "Display options", exact: true }).click();
    await page.getByRole("switch", { name: "Show snoozed", exact: true }).uncheck();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Show unreads only", exact: true }).click();
    await expect.poll(async () => {
      const preferences = (await f.state()).users.find((item: any) => item.id === f.initial.user.id).preferences.inbox;
      return [preferences.showSnoozed, preferences.unreadOnly];
    }).toEqual([false, true]);
    // Leave the previously selected detail so its automatic read cannot consume the wake.
    await page.getByRole("link", { name: "My issues", exact: true }).click();
    await page.getByRole("link", { name: "Inbox", exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveClass(/unread/);
    await expect(badge).toHaveText("1");
    expect((await record()).snoozedUntil).toBe(new Date(deadline).toISOString());
    expect((await record()).readAt, "The renderer woke before any scheduler or read write").toBe(earlierRead);
    await row.click({ modifiers: ["Alt"] });
    await expect.poll(async () => Date.parse((await record()).readAt)).toBeGreaterThanOrEqual(deadline);
    await expect(row).not.toHaveClass(/unread/);
    await expect(badge).toHaveCount(0);
    const explicitRead = (await record()).readAt;
    await f.patch("issues", issue.id, { title: "Explicit wake read survives a store update" });
    await expect(row).toContainText("Explicit wake read survives a store update");
    await expect(row).not.toHaveClass(/unread/);
    await expect(badge).toHaveCount(0);
    expect((await record()).readAt).toBe(explicitRead);
    expect((await record()).snoozedUntil).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await f.app.close();
  }
});

test("narrow Inbox navigation delays full-stack reads, preserves recent manual unread and cancels reads when leaving", async ({ page }) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(12_000);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.addInitScript(() => {
    const testWindow = window as any;
    testWindow.__inboxReadWrites = [];
    testWindow.__inboxNavigationEvents = [];
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/v1/batch") && typeof init?.body === "string") {
        try {
          const operations = JSON.parse(init.body).operations;
          const reads = operations?.filter((operation: any) => operation.kind === "notifications" && typeof operation.data?.readAt === "string");
          if (reads?.length) testWindow.__inboxReadWrites.push({ at: Date.now(), ids: reads.map((operation: any) => operation.id) });
        } catch { /* Observe requests without changing fetch behavior. */ }
      }
      return originalFetch.call(this, input, init);
    };
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      testWindow.__inboxNavigationEvents.push({ at: Date.now(), path: location.pathname });
      return result;
    };
    window.addEventListener("popstate", () => testWindow.__inboxNavigationEvents.push({ at: Date.now(), path: location.pathname }));
  });
  const f = await fixture(page, "inbox-narrow-timing", {});
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const issue = await f.create("issues", { title: "Narrow stack timing", teamId: f.initial.teams[0].id });
    const one = await f.create("notifications", { type: "assigned", title: issue.title, issueId: issue.id });
    const two = await f.create("notifications", { type: "comments", title: issue.title, issueId: issue.id });
    const ids = [one.id, two.id].sort();
    const reads = async () => (await f.state()).notifications.filter((item: any) => ids.includes(item.id)).map((item: any) => !!item.readAt);
    const selector = `[data-notification-stack-id="issue#${issue.id}"]`;
    await page.goto(`${f.url}/inbox`);
    const row = page.locator(selector);
    await expect(row).toBeVisible();
    await row.evaluate(element => { (window as any).__inboxSelectedAt = Date.now(); (element as HTMLButtonElement).click(); });
    await expect(page).toHaveURL(`${f.url}/issues/${issue.id}`);
    await expect.poll(reads).toEqual([true, true]);
    const opening = await page.evaluate(() => ({ selected: (window as any).__inboxSelectedAt, reads: (window as any).__inboxReadWrites, navigation: (window as any).__inboxNavigationEvents }));
    const navigation = opening.navigation.find((event: any) => event.path === `/issues/${issue.id}`);
    expect(navigation.at - opening.selected).toBeLessThan(290);
    expect(opening.reads[0].at - opening.selected).toBeGreaterThanOrEqual(290);
    expect(opening.reads.flatMap((event: any) => event.ids).sort()).toEqual(ids);

    await page.goto(`${f.url}/inbox`);
    await expect(row).toBeVisible();
    await row.evaluate(element => {
      const testWindow = window as any;
      testWindow.__inboxReadWrites = [];
      testWindow.__inboxManualUnreadAt = Date.now();
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
      (element as HTMLButtonElement).click();
    });
    await expect(page).toHaveURL(`${f.url}/issues/${issue.id}`);
    await expect.poll(reads).toEqual([false, false]);
    await page.waitForFunction(() => Date.now() - (window as any).__inboxManualUnreadAt >= 750);
    expect(await reads()).toEqual([false, false]);
    expect(await page.evaluate(() => (window as any).__inboxReadWrites)).toEqual([]);

    await page.goto(`${f.url}/inbox`);
    await expect(row).toBeVisible();
    await row.evaluate(element => {
      const testWindow = window as any;
      testWindow.__inboxReadWrites = [];
      testWindow.__inboxLeavingAt = Date.now();
      (element as HTMLButtonElement).click();
      setTimeout(() => history.back(), 50);
    });
    await page.waitForFunction(() => Date.now() - (window as any).__inboxLeavingAt >= 750);
    await expect(page).toHaveURL(`${f.url}/inbox`);
    const cancellation = await page.evaluate(() => ({ at: (window as any).__inboxLeavingAt, navigation: (window as any).__inboxNavigationEvents, writes: (window as any).__inboxReadWrites }));
    const destination = cancellation.navigation.find((event: any) => event.path === `/issues/${issue.id}` && event.at >= cancellation.at);
    const departed = cancellation.navigation.find((event: any) => event.path === "/inbox" && event.at >= destination.at);
    expect(departed.at - destination.at).toBeLessThan(290);
    expect(cancellation.writes).toEqual([]);
    expect(await reads()).toEqual([false, false]);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await f.app.close();
  }
});
