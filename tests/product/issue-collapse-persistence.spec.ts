import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';
import { issueCollapseKey } from '../../src/client/issue-collapse-state';

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Collapse tester', email: 'collapse@example.test', password: 'isolated-collapse-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  for (const type of ['started', 'unstarted', 'backlog', 'completed']) {
    const status = state.statuses.find((s: any) => s.teamId === team.id && s.type === type);
    app.repo.create(actor, 'issues', { title: type + ' example', teamId: team.id, statusId: status.id, assigneeId: state.user.id, priority: 2 });
  }
  const view = app.repo.create(actor, 'views', { name: 'Master issue view', entityType: 'issues', visibility: 'workspace', filters: { match: 'all', conditions: [] }, display: { groupBy: 'statusId', subGroupBy: 'none', layout: 'list', showCompleted: 'all' } });
  const route = url + '/view/' + view.id;
  const key = `display:${state.workspaceId}:${state.user.id}:${view.id}`;
  await page.goto(route);
  await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
  return { app, url, actor, state, team, view, route, key };
}

const toggle = (page: Page, name: string) => page.locator('.group-header').filter({ has: page.getByText(name, { exact: true }) }).locator('.group-toggle');
async function grouping(page: Page, primary: string, secondary = 'none') {
  await page.getByRole('button', { name: 'Display options', exact: true }).click();
  await page.getByLabel('Grouping', { exact: true }).selectOption(primary);
  await page.getByLabel('Sub-grouping', { exact: true }).selectOption(secondary);
  await page.keyboard.press('Escape');
}

test('saved-view collapse survives navigation, issue opening/creation, reload and a fresh browser session', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    await toggle(page, 'Done').click();
    await toggle(page, 'Backlog').click();
    const unchangedView = (await (await page.request.get(f.url + '/api/v1/state')).json()).views;
    // Real client-side navigation unmounts the saved view.
    await page.getByRole('link', { name: 'My issues', exact: true }).click();
    await expect(page).not.toHaveURL(f.route);
    await page.goBack();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page, 'Backlog')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.issue-row-title').filter({ hasText: 'started example' }).first().click();
    await expect(page).not.toHaveURL(f.route);
    await page.goBack();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('complementary').getByRole('button', { name: 'Create new issue', exact: true }).click();
    await page.getByLabel('Issue title', { exact: true }).fill('Created without reopening collapsed groups');
    await page.getByRole('button', { name: 'Create issue', exact: true }).click();
    await expect.poll(async () => (await (await page.request.get(f.url + '/api/v1/state')).json()).issues.length).toBe(5);
    await page.reload();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page, 'Backlog')).toHaveAttribute('aria-expanded', 'false');
    expect((await (await page.request.get(f.url + '/api/v1/state')).json()).views).toEqual(unchangedView);
    // A fresh JS runtime must recover from disk storage, not module memory.
    const restored = await browser.newContext({ storageState: await page.context().storageState() });
    try {
      const reopened = await restored.newPage();
      await reopened.goto(f.route);
      await expect(toggle(reopened, 'Done')).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle(reopened, 'Backlog')).toHaveAttribute('aria-expanded', 'false');
      await toggle(reopened, 'Done').click();
      await reopened.reload();
      await expect(toggle(reopened, 'Done')).toHaveAttribute('aria-expanded', 'true');
    } finally { await restored.close(); }
  } finally { await page.close(); await f.app.close(); }
});

test('each view and grouping remembers its own top-level and nested collapse choices', async ({ page }) => {
  const f = await fixture(page);
  try {
    await toggle(page, 'Done').click();
    await page.goto(f.url + '/team/' + f.team.id + '/all');
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await toggle(page, 'Backlog').click();
    await page.goto(f.route);
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page, 'Backlog')).toHaveAttribute('aria-expanded', 'true');
    await grouping(page, 'priority', 'assigneeId');
    const sub = page.locator(`.issue-subgroup-header[data-group-id="${f.state.user.id}"] .group-toggle`);
    await expect(sub).toHaveAttribute('aria-expanded', 'true');
    await sub.click();
    await page.reload();
    await expect(sub).toHaveAttribute('aria-expanded', 'false');
    await grouping(page, 'statusId');
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await grouping(page, 'priority', 'assigneeId');
    await expect(sub).toHaveAttribute('aria-expanded', 'false');
    await page.goto(f.url + '/team/' + f.team.id + '/all');
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'Backlog')).toHaveAttribute('aria-expanded', 'false');
    // Profile tabs reuse the same component; no old state can leak across keys.
    await page.goto(f.url + '/profiles/' + f.state.user.id);
    await toggle(page, 'Done').click();
    await page.getByRole('link', { name: 'Created', exact: true }).click();
    await grouping(page, 'statusId');
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: 'Assigned', exact: true }).click();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
  } finally { await page.close(); await f.app.close(); }
});

test('Option-click and keyboard collapse persist and synchronize between open tabs', async ({ page }) => {
  const f = await fixture(page);
  try {
    const second = await page.context().newPage();
    await second.goto(f.route);
    await expect(toggle(second, 'Done')).toHaveAttribute('aria-expanded', 'true');
    const groupCount = await page.locator('.group-toggle').count();
    await toggle(page, 'Done').click({ modifiers: ['Alt'] });
    await expect(page.getByRole('button', { name: 'Collapse group', exact: true })).toHaveCount(0);
    await expect(toggle(second, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand group', exact: true })).toHaveCount(groupCount);
    await toggle(page, 'Done').hover();
    await page.keyboard.press('t');
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await page.reload();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'Backlog')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Alt+t');
    await expect(page.getByRole('button', { name: 'Expand group', exact: true })).toHaveCount(0);
    await page.keyboard.press('Alt+t');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand group', exact: true })).toHaveCount(groupCount);
    await second.close();
  } finally { await page.close(); await f.app.close(); }
});

test('invalid or unwritable collapse storage does not break disclosure controls', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.evaluate(key => localStorage.setItem(key, '{broken'), issueCollapseKey(f.key, 'statusId'));
    await page.reload();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key.includes(':collapsed-groups:')) throw new DOMException('Storage full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await toggle(page, 'Done').click();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('link', { name: 'My issues', exact: true }).click();
    await page.goBack();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'false');
    await toggle(page, 'Done').click();
    await expect(toggle(page, 'Done')).toHaveAttribute('aria-expanded', 'true');
  } finally { await page.close(); await f.app.close(); }
});
