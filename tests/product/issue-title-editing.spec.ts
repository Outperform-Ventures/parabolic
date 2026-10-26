import {test, expect, type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({databasePath: ':memory:', port: 0, staticDir: resolve('dist')}), {url} = await app.start();
  await page.addInitScript(() => {
    (window as any).desktop = {isDesktop: true, platform: 'darwin', onCommand: () => () => {}, setBadge: async () => {}, setTheme: async () => {}, notify: async () => true,
      onPrepareRestart: (callback: () => Promise<void>) => { (window as any).prepareRestart = callback; return () => {}; }};
  });
  await page.request.post(url + '/auth/setup', {data: {name: 'Title tester', email: 'title@example.test', password: 'isolated-title-test'}});
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = {userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin']};
  const issue = app.repo.create(actor, 'issues', {title: 'Original title', teamId: state.teams[0].id});
  const other = app.repo.create(actor, 'issues', {title: 'Other issue', teamId: state.teams[0].id});
  const updates = () => app.repo.all('activities', state.workspaceId).filter(row => row.entityId === issue.id && row.action === 'update' && row.changes?.title);
  const title = page.getByLabel('Issue title', {exact: true}), route = url + '/issues/' + issue.id;
  const journal = `issue-edit:${state.user.id}:${issue.id}`;
  await page.goto(route); await expect(title).toHaveValue(issue.title);
  return {app, url, actor, issue, other, updates, title, route, journal};
}
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

test('slow title typing and pauses produce one activity record only when editing finishes', async ({page}) => {
  const f = await fixture(page); try {
    await f.title.focus(); await f.title.press('End');
    await f.title.pressSequentially(' fifteen letters', {delay: 100});
    await page.waitForTimeout(900);
    expect(f.updates()).toHaveLength(0);
    await expect(f.title).toHaveValue('Original title fifteen letters');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).title, f.journal)).toBe('Original title fifteen letters');
    await f.title.press('Enter');
    await expect.poll(() => f.updates().length).toBe(1);
    expect(f.updates()[0].changes.title).toEqual({from: 'Original title', to: 'Original title fifteen letters'});
    await expect(page.locator('.activity-event').filter({hasText: 'updated the issue'})).toHaveCount(1);
    await f.title.focus(); await blur(page); expect(f.updates()).toHaveLength(1);
    await page.reload(); await expect(f.title).toHaveValue('Original title fifteen letters'); expect(f.updates()).toHaveLength(1);
  } finally { await page.close(); await f.app.close(); }
});
test('blur and route changes commit to the correct issue without cross-issue drafts', async ({page}) => {
  const f = await fixture(page); try {
    await f.title.fill('Saved on leaving');
    await page.getByRole('link', {name: 'Customers', exact: true}).click();
    await expect.poll(() => f.app.repo.get(f.actor, 'issues', f.issue.id).title).toBe('Saved on leaving');
    await page.goto(f.url + '/issues/' + f.other.id); await expect(f.title).toHaveValue('Other issue');
    await f.title.fill('Second issue edit'); await f.title.press('Escape');
    await expect.poll(() => f.app.repo.get(f.actor, 'issues', f.other.id).title).toBe('Second issue edit');
    expect(f.updates()).toHaveLength(1);
    await page.goto(f.route); await expect(f.title).toHaveValue('Saved on leaving');
  } finally { await page.close(); await f.app.close(); }
});
test('empty, reverted and composition edits do not create intermediate title records', async ({page}) => {
  const f = await fixture(page); try {
    await f.title.fill('Temporary'); await f.title.fill('Original title'); await blur(page);
    await f.title.fill('   '); await f.title.press('Enter'); await expect(f.title).toHaveValue('Original title');
    await f.title.fill('Composed title');
    await f.title.dispatchEvent('keydown', {key: 'Enter', isComposing: true});
    await expect(f.title).toBeFocused(); expect(f.updates()).toHaveLength(0);
    await f.title.press('Enter'); await expect.poll(() => f.updates().length).toBe(1);
    expect(f.updates()[0].changes.title.to).toBe('Composed title');
  } finally { await page.close(); await f.app.close(); }
});
test('reload recovers an unfinished title, and restart flushes it even while focused', async ({page}) => {
  const f = await fixture(page); try {
    await f.title.fill('Recovered after reload'); await page.reload();
    await expect(f.title).toHaveValue('Recovered after reload'); await expect.poll(() => f.updates().length).toBe(1);
    await f.title.fill('Saved before restart');
    await page.evaluate(async () => { await (window as any).prepareRestart(); });
    await expect.poll(() => f.updates().length).toBe(2);
    await page.reload(); await expect(f.title).toHaveValue('Saved before restart');
    expect(f.updates()).toHaveLength(2);
  } finally { await page.close(); await f.app.close(); }
});
test('offline commit survives reload and syncs as a single update on reconnect', async ({page, context}) => {
  const f = await fixture(page); try {
    await context.setOffline(true); await f.title.fill('Offline edit'); await blur(page);
    await page.evaluate(async () => { await (window as any).prepareRestart(); });
    expect(f.updates()).toHaveLength(0);
    await context.setOffline(false); await page.reload();
    await expect(f.title).toHaveValue('Offline edit'); await expect.poll(() => f.updates().length).toBe(1);
    expect(f.updates()[0].changes.title.to).toBe('Offline edit');
  } finally { await context.setOffline(false); await page.close(); await f.app.close(); }
});
