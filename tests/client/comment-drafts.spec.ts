import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("comment and reply drafts survive issue navigation and reload, resume from Drafts, and clear only after sending", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Draft author",
        email: "drafts@example.test",
        password: "isolated-comment-drafts",
        workspaceName: "Drafts",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const first = await create("issues", {
      title: "Draft source",
      teamId: initial.teams[0].id,
    });
    const second = await create("issues", {
      title: "Draft destination",
      teamId: initial.teams[0].id,
      parentId: first.id,
    });
    const thread = await create("comments", {
      issueId: first.id,
      body: "<p>Thread root</p>",
    });
    const rootEditor = () =>
      page.locator(
        '.activity-section > .comment-composer [contenteditable="true"]',
      );
    const replyEditor = () =>
      page.locator(
        `[data-thread-id="${thread.id}"] .comment-thread-reply-composer [contenteditable="true"]`,
      );
    const visit = async (id: string) => {
      await page.goto(`${url}/issues/${id}`);
      await expect(page.locator(".issue-detail-view")).toHaveAttribute(
        "data-issue-id",
        id,
      );
      await expect(rootEditor()).toBeVisible();
    };
    await visit(first.id);
    await rootEditor().fill("Unsent root survives navigation");
    await expect(replyEditor()).toHaveText("");
    await replyEditor().fill("Unsent thread survives separately");
    await replyEditor().press("ArrowRight");
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.isCollapsed))
      .toBe(true);
    await expect(rootEditor()).toHaveText("Unsent root survives navigation");
    await page
      .locator(".sub-issue-row")
      .filter({ hasText: "Draft destination" })
      .click();
    await expect(page.locator(".issue-detail-view")).toHaveAttribute(
      "data-issue-id",
      second.id,
    );
    await expect(rootEditor()).toHaveText("");
    await rootEditor().fill("Destination stays on its own issue");
    const attachmentBytes = Buffer.from(
      "Draft attachment remains available after reload.\n",
    );
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page
        .locator(".activity-section > .comment-composer")
        .getByRole("button", {
          name: "Attach images, files, or videos",
          exact: true,
        })
        .press("Enter"),
    ]);
    await chooser.setFiles({
      name: "draft-note.txt",
      mimeType: "text/plain",
      buffer: attachmentBytes,
    });
    const attachment = rootEditor().getByRole("link", {
      name: "draft-note.txt",
      exact: true,
    });
    await expect(attachment).toBeVisible();
    const href = await attachment.getAttribute("href");
    expect(await (await page.request.get(url + href)).body()).toEqual(
      attachmentBytes,
    );
    const [shortcutChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      rootEditor().press("ControlOrMeta+Shift+A"),
    ]);
    await shortcutChooser.setFiles([]);
    await page.reload();
    await expect(rootEditor()).toContainText("Destination stays on its own issue");
    await expect(
      rootEditor().getByRole("link", { name: "draft-note.txt", exact: true }),
    ).toBeVisible();
    await page.goto(`${url}/drafts`);
    await expect(page.locator(".draft-row")).toHaveCount(3);
    await page
      .getByRole("button", {
        name: new RegExp(`^Reply on ${first.identifier}`),
      })
      .click();
    await expect(replyEditor()).toHaveText("Unsent thread survives separately");
    await page
      .locator(`[data-thread-id="${thread.id}"]`)
      .getByRole("button", { name: "Submit comment", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await state()).comments.filter((row: any) =>
          row.body.includes("Unsent thread survives separately"),
        ),
      )
      .toHaveLength(1);
    const sent = (await state()).comments.find((row: any) =>
      row.body.includes("Unsent thread survives separately"),
    );
    expect(sent.issueId).toBe(first.id);
    expect(sent.parentId).toBe(thread.id);
    await expect(rootEditor()).toHaveText("Unsent root survives navigation");
    await page.goto(`${url}/drafts`);
    await expect(page.locator(".draft-row")).toHaveCount(2);
    await page
      .getByRole("button", {
        name: new RegExp(`Discard Comment on ${first.identifier}`),
      })
      .click();
    await expect(page.locator(".draft-row")).toHaveCount(1);
    await visit(first.id);
    await expect(rootEditor()).toHaveText("");
    await visit(second.id);
    await expect(rootEditor()).toContainText("Destination stays on its own issue");
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("a comment waiting for IndexedDB can remount and retry without creating a duplicate", async ({page}) => {
  test.setTimeout(60000);page.setDefaultTimeout(12000);
  const app = createApp({databasePath: ":memory:", port: 0, staticDir: resolve("dist")});
  const {url} = await app.start();const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const setup = await page.request.post(`${url}/auth/setup`, {data: {name: "Draft retry", email: "draft-retry@example.test", password: "isolated-draft-retry", workspaceName: "Draft retry"}});
    expect(setup.ok()).toBeTruthy();
    const initial = await (await page.request.get(`${url}/api/v1/state`)).json();
    const issue = await (await page.request.post(`${url}/api/v1/issues`, {data: {title: "Draft retry target", teamId: initial.teams[0].id}})).json();
    await page.goto(`${url}/issues/${issue.id}`);
    const editor = () => page.getByRole('textbox', {name: 'Leave a comment…', exact: true});
    const submit = () => page.locator('.activity-section > .comment-composer').getByRole('button', {name: 'Submit comment', exact: true});
    await expect(editor()).toBeVisible();await editor().fill("One durable comment, even after remount");
    const key = `comment-drafts:${initial.user.id}:${initial.workspaceId}`;
    const serialized = await page.evaluate(key => localStorage.getItem(key)!, key);
    const revision = JSON.parse(serialized)[0].revision;
    await page.evaluate(() => {
      const w = window as any, original = IDBTransaction.prototype.addEventListener;
      w.__commentGate = {held: false, claimed: false, restore: () => {IDBTransaction.prototype.addEventListener = original;}};
      IDBTransaction.prototype.addEventListener = function(type: any, listener: any, options?: any) {
        if (type === 'complete' && !w.__commentGate.claimed && this.mode === 'readwrite' && this.db.name === 'parabolic-client' && this.objectStoreNames.contains('outbox')) {
          w.__commentGate.claimed = true;
          return original.call(this, type, function(this: IDBTransaction, event) {
            w.__commentGate.held = true;
            w.__commentGate.release = () => {IDBTransaction.prototype.addEventListener = original; listener.call(this, event);};
          }, options);
        }
        return original.call(this, type, listener, options);
      };
    });
    await submit().click();
    await page.waitForFunction(() => (window as any).__commentGate.held);
    await page.locator('.sidebar').getByRole('link', {name: 'Projects', exact: true}).click();await page.waitForURL('**/projects');
    await expect(page.locator('.feature-page header').getByRole('button', {name: 'New project', exact: true})).toBeVisible();
    await expect(page.locator('.comment-composer')).toHaveCount(0);
    await page.goBack();await page.waitForURL(`**/issues/${issue.id}`);
    await expect(editor()).toHaveText('One durable comment, even after remount');
    await expect(submit()).toBeDisabled();
    await editor().press('Enter');
    await page.evaluate(() => (window as any).__commentGate.release());
    const matchingComments = async () => (await (await page.request.get(`${url}/api/v1/state`)).json()).comments.filter((row: any) => row.issueId === issue.id);
    await expect.poll(matchingComments).toHaveLength(1);expect((await matchingComments())[0].id).toBe(revision);
    await expect(editor()).toHaveText('');
    // Simulate a second window retaining the draft after another window has
    // already queued/saved it. A reload removes the in-memory send claim.
    await page.reload();await expect(editor()).toBeVisible();
    await page.evaluate(({key, serialized}) => {localStorage.setItem(key, serialized);window.dispatchEvent(new StorageEvent('storage', {key,newValue:serialized}));}, {key,serialized});
    await expect(editor()).toHaveText('One durable comment, even after remount');
    await submit().click();
    await expect(editor()).toHaveText('');expect(await matchingComments()).toHaveLength(1);
    await expect(page.getByText('An item with this ID already exists', {exact:true})).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => {const gate = (window as any).__commentGate;gate?.release?.();gate?.restore?.();}).catch(() => {});
    await app.close();
  }
});
