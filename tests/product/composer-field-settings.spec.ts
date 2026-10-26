import {test, expect, type Page, type Locator} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({databasePath: ':memory:', port: 0, staticDir: resolve('dist')}), {url} = await app.start();
  await page.request.post(url + '/auth/setup', {data: {name: 'Composer layout tester', email: 'composer-layout@example.test', password: 'isolated-composer-test'}});
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = {userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin']};
  app.repo.update(actor, 'users', state.user.id, {preferences: {...state.user.preferences, displayNames: 'Full name'}});
  const issue = app.repo.create(actor, 'issues', {title: 'Parent fixture', teamId: state.teams[0].id});
  const preferences = () => app.repo.get(actor, 'users', state.user.id).preferences;
  await page.goto(url + '/my-issues'); await openComposer(page);
  return {app, url, actor, issue, preferences};
}
const card = (page: Page) => page.locator('.issue-composer');
const menu = (page: Page) => page.locator('.composer-settings-menu');
const openComposer = async (page: Page) => { await page.getByRole('complementary').getByRole('button', {name: 'Create new issue', exact: true}).click(); await expect(card(page)).toBeVisible(); };
const openSettings = async (page: Page) => { await card(page).getByRole('button', {name: 'More actions', exact: true}).click(); await expect(menu(page)).toBeVisible(); };
const chipIds = (page: Page) => card(page).locator('.composer-properties [data-property]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-property')));

test('customer creation chips match sibling styling in every composer mode and theme', async ({page}, info) => {
  const f = await fixture(page); try {
    const customer = f.app.repo.create(f.actor, 'customers', {name: 'Style fixture customer'});
    const appearance = (locator: Locator) => locator.evaluate(el => {
      const style = getComputedStyle(el);
      return Object.fromEntries(['backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderRadius', 'height', 'padding', 'fontSize', 'fontWeight', 'lineHeight', 'gap'].map(key => [key, style[key as any]]));
    });
    const compare = async () => {
      await expect(card(page).getByLabel('Quick suggestions', {exact: true})).toHaveCount(0);
      await expect(card(page).getByRole('button', {name: /Apply (all quick suggestions|suggested)/})).toHaveCount(0);
      const customerChip = card(page).locator('.customer-assignment-trigger'), priority = card(page).locator('[data-property="priority"]');
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await card(page).getByLabel('Issue title', {exact: true}).hover();
        expect(await appearance(customerChip)).toEqual(await appearance(priority));
        // Priority uses a nested glyph with its own viewBox; the customer uses
        // the shared direct-SVG composer icon dimensions.
        await expect(customerChip.locator('svg')).toHaveCSS('width', '14px');
        await expect(customerChip.locator('svg')).toHaveCSS('height', '14px');
        const customerBox = (await customerChip.boundingBox())!, priorityBox = (await priority.boundingBox())!;
        expect(customerBox.x + customerBox.width <= priorityBox.x || customerBox.y + customerBox.height <= priorityBox.y).toBe(true);
        await customerChip.hover(); const hovered = await appearance(customerChip);
        await priority.hover(); expect(hovered).toEqual(await appearance(priority));
      }
    };
    await compare();
    await card(page).locator('.customer-assignment-trigger').click();
    await page.getByRole('dialog', {name: 'Assign customers', exact: true}).getByRole('combobox').fill(customer.name);
    await page.getByRole('option', {name: customer.name, exact: true}).click();
    await expect(card(page).locator('.customer-assignment-trigger')).toHaveText(customer.name);
    await compare();
    await page.screenshot({path: info.outputPath('matching-customer-chip.png')});
    await card(page).getByRole('button', {name: 'Expand composer', exact: true}).click(); await compare();
    await page.goto(f.url + '/issues/' + f.issue.id);
    await page.getByRole('button', {name: 'Create new sub-issue', exact: true}).click(); await compare();
    await page.screenshot({path: info.outputPath('matching-inline-customer-chip.png')});
    expect(await page.locator('.issue-properties-panel .customer-assignment-trigger').getAttribute('class')).not.toContain('property-button');
  } finally { await page.close(); await f.app.close(); }
});

test('drag and visibility immediately change chips, persist across new cards/reload/fresh browser, and leave issue values untouched', async ({page, browser}, info) => {
  const f = await fixture(page); try {
    const original = f.app.repo.get(f.actor, 'issues', f.issue.id);
    await openSettings(page);
    await menu(page).getByRole('menuitemcheckbox', {name: 'Labels', exact: true}).click();
    await menu(page).getByRole('menuitemcheckbox', {name: 'Due date', exact: true}).click();
    await menu(page).getByRole('menuitemcheckbox', {name: 'Cycle', exact: true}).click();
    const source = menu(page).getByRole('button', {name: 'Reorder Priority field', exact: true});
    await source.dragTo(menu(page).locator('[data-composer-setting="customers"]'), {targetPosition: {x: 110, y: 3}});
    await expect.poll(async () => (await chipIds(page))[0]).toBe('priority');
    await expect.poll(() => chipIds(page)).not.toContain('labelIds');
    await expect.poll(() => chipIds(page)).toContain('dueDate');
    await expect.poll(() => f.preferences().issueComposerFields?.order[0]).toBe('priority');
    await expect.poll(() => f.preferences().issueComposerFields?.hidden).toContain('labelIds');
    expect(f.preferences().displayNames).toBe('Full name');
    expect(await menu(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({path: info.outputPath('composer-field-settings.png')});
    const expected = await chipIds(page);
    await page.keyboard.press('Escape'); await card(page).getByRole('button', {name: 'Close composer', exact: true}).click();
    await openComposer(page); expect(await chipIds(page)).toEqual(expected);
    await page.reload(); await openComposer(page); expect(await chipIds(page)).toEqual(expected);
    const session = await page.context().storageState();
    const fresh = await browser.newContext({storageState: {cookies: session.cookies, origins: []}});
    try { const other = await fresh.newPage(); await other.goto(f.url + '/my-issues'); await openComposer(other); expect(await chipIds(other)).toEqual(expected); }
    finally { await fresh.close(); }
    expect(f.app.repo.get(f.actor, 'issues', f.issue.id)).toEqual(original);
  } finally { await page.close(); await f.app.close(); }
});

test('keyboard reordering and hide/show work in expanded and inline creation; due date chip is editable', async ({page}) => {
  const f = await fixture(page); try {
    await openSettings(page);
    await menu(page).getByRole('menuitemcheckbox', {name: 'Due date', exact: true}).click();
    const handle = menu(page).getByRole('button', {name: 'Reorder Status field', exact: true});
    await handle.focus(); await handle.press('Alt+ArrowUp');
    await expect.poll(async () => (await chipIds(page))[0]).toBe('statusId');
    await page.keyboard.press('Escape'); await card(page).getByRole('button', {name: 'Expand composer', exact: true}).click();
    const expected = await chipIds(page);
    await card(page).getByRole('button', {name: 'Set due date', exact: true}).click();
    await page.getByRole('menuitem', {name: /Tomorrow/}).click();
    await expect(card(page).locator('[data-property="dueDate"] time')).toHaveCount(1);
    await page.goto(f.url + '/issues/' + f.issue.id);
    await page.getByRole('button', {name: 'Create new sub-issue', exact: true}).click();
    await expect(card(page)).toBeVisible();
    expect((await chipIds(page)).filter(id => id !== 'teamId')).toEqual(expected);
    await openSettings(page); await menu(page).getByRole('menuitemcheckbox', {name: 'Status', exact: true}).click();
    await expect.poll(() => chipIds(page)).not.toContain('statusId');
    await menu(page).getByRole('menuitemcheckbox', {name: 'Status', exact: true}).click();
    await expect.poll(async () => (await chipIds(page))[1]).toBe('statusId');
  } finally { await page.close(); await f.app.close(); }
});

test('hiding a populated field keeps its value on creation and supports all fields hidden', async ({page}) => {
  const f = await fixture(page); try {
    await card(page).locator('[data-property="priority"]').click();
    await page.locator('[data-property-menu="priority"]').getByRole('button', {name: 'High', exact: true}).click();
    await openSettings(page);
    const checked = menu(page).getByRole('menuitemcheckbox', {checked: true});
    while (await checked.count()) await checked.first().click();
    await expect.poll(() => chipIds(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await card(page).getByLabel('Issue title', {exact: true}).fill('Hidden priority is retained');
    await card(page).getByRole('button', {name: 'Create issue', exact: true}).click();
    await expect.poll(() => f.app.repo.all('issues', f.actor.workspaceId).find(issue => issue.title === 'Hidden priority is retained')?.priority).toBe(2);
    await openComposer(page); await expect.poll(() => chipIds(page)).toEqual([]);
    await openSettings(page); await menu(page).getByRole('menuitemcheckbox', {name: 'Priority', exact: true}).click();
    await expect.poll(() => chipIds(page)).toEqual(['priority']);
  } finally { await page.close(); await f.app.close(); }
});
