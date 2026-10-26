import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Inline Example', email: 'inline@example.test', password: 'isolated-inline-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  const project = app.repo.create(actor, 'projects', { name: 'Original project', teamIds: [team.id], icon: 'Shop' });
  const otherProject = app.repo.create(actor, 'projects', { name: 'Other project', teamIds: [team.id], icon: 'Shop' });
  const now = new Date().toISOString();
  const person = { id: crypto.randomUUID(), workspaceId: state.workspaceId, name: 'Other member', email: 'member@example.test', createdAt: now, updatedAt: now, version: 1 };
  app.repo.save('users', person, 'create', actor);
  app.repo.save('memberships', { id: crypto.randomUUID(), workspaceId: state.workspaceId, userId: person.id, role: 'member', createdAt: now, updatedAt: now, version: 1 }, 'create', actor);
  app.repo.create(actor, 'memberships', { teamId: team.id, userId: person.id, role: 'member' });
  const label = app.repo.create(actor, 'labels', { name: 'Original label', color: '#5e6ad2', entityType: 'issues' });
  const otherLabel = app.repo.create(actor, 'labels', { name: 'Other label', color: '#f97316', entityType: 'issues' });
  const cycle = app.repo.create(actor, 'cycles', { name: 'Current cycle', teamId: team.id, startDate: '2026-09-07', endDate: '2026-09-14' });
  const otherCycle = app.repo.create(actor, 'cycles', { name: 'Next cycle', teamId: team.id, startDate: '2026-09-14', endDate: '2026-09-21' });
  const milestone = app.repo.create(actor, 'milestones', { name: 'First milestone', projectId: project.id });
  const otherMilestone = app.repo.create(actor, 'milestones', { name: 'Second milestone', projectId: project.id });
  const issue = app.repo.create(actor, 'issues', { title: 'Inline editing example', teamId: team.id, projectId: project.id, milestoneId: milestone.id, cycleId: cycle.id, assigneeId: state.user.id, labelIds: [label.id], estimate: 3, priority: 2, dueDate: '2026-09-30' });
  const route = url + '/profiles/' + state.user.id + '/created';
  const key = `display:${state.workspaceId}:${state.user.id}:profile:${state.user.id}:Created`;
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ groupBy: 'none', properties: ['identifier', 'priority', 'statusId', 'projectId', 'assigneeId', 'estimate', 'dueDate', 'createdAt', 'labelIds', 'cycleId', 'milestoneId'] })); }, key);
  await page.goto(route);
  await expect(page.locator('.issue-row')).toBeVisible();
  const saved = async () => (await (await page.request.get(url + '/api/v1/state')).json()).issues.find((i: any) => i.id === issue.id);
  return { app, url, route, issue, state, actor, key, project, otherProject, person, otherLabel, otherCycle, otherMilestone, saved };
}

for (const board of [false, true]) test(`inline ${board ? 'board' : 'list'} fields save without opening the issue`, async ({ page }, info) => {
  test.setTimeout(60000);
  const f = await fixture(page);
  try {
    if (board) {
      await page.getByRole('button', { name: 'Display options', exact: true }).click();
      await page.getByRole('tab', { name: 'Board', exact: true }).click();
      await page.keyboard.press('Escape');
    }
    const row = page.locator(board ? '.board-card' : '.issue-row');
    const choose = async (field: string, name: string, expected: any) => {
      await row.locator(`[data-property="${field}"]`).first().click();
      const menu = page.locator('.inline-issue-property-menu');
      await expect(menu).toBeVisible();
      await expect(page).toHaveURL(f.route);
      await menu.getByRole('option', { name, exact: true }).click();
      if (field === 'labelIds') await page.keyboard.press('Escape');
      await expect.poll(async () => (await f.saved())[field]).toEqual(expected);
      await expect(page).toHaveURL(f.route);
      await expect(page.locator('.issue-detail-view')).toHaveCount(0);
    };
    await choose('priority', 'Low', 4);
    const status = f.state.statuses.find((s: any) => s.teamId === f.issue.teamId && s.type === 'started');
    await choose('statusId', status.name, status.id);
    await choose('estimate', '5 Points', 5);
    await choose('assigneeId', 'Other member', f.person.id);
    await choose('cycleId', 'Next cycle', f.otherCycle.id);
    await choose('milestoneId', 'Second milestone', f.otherMilestone.id);
    await choose('labelIds', 'Other label', [...f.issue.labelIds, f.otherLabel.id]);
    await choose('projectId', 'Other project', f.otherProject.id);
    expect((await f.saved()).milestoneId).toBeNull();
    await row.getByRole('button', { name: 'Change due date', exact: true }).click();
    const due = page.getByRole('menu', { name: 'Change due date', exact: true });
    await expect(due.getByRole('searchbox')).toHaveAttribute('placeholder', 'Try: 24h, 7 days, Feb 9');
    await expect(due.getByRole('menuitem')).toHaveCount(5);
    await due.getByRole('searchbox').fill('2026-10-05');
    await due.getByRole('searchbox').press('Enter');
    await expect.poll(async () => (await f.saved()).dueDate).toBe('2026-10-05');
    await expect(page).toHaveURL(f.route);
    await page.reload();
    await expect(row).toContainText('Other project');
    await expect(row.locator('.issue-estimate, .board-card-estimate')).toContainText('5');
    await row.getByRole('button', { name: 'Change due date', exact: true }).click();
    await expect(due.getByRole('menuitem').first()).toContainText('Remove due date');
    await page.screenshot({ path: info.outputPath(`inline-${board ? 'board' : 'list'}-due-menu.png`) });
    await page.keyboard.press('Escape');
    await row.locator(board ? '.board-card-title' : '.issue-row-title').click();
    await expect(page).toHaveURL(f.url + '/issues/' + f.issue.id);
  } finally { await page.close(); await f.app.close(); }
});

test('imported exponential effort values retain their selected value and full menu', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    f.app.repo.update(f.actor, 'issues', f.issue.id, { estimate: 16 });
    await page.reload();
    await page.locator('.issue-row [data-property="estimate"]').click();
    const menu = page.locator('.inline-issue-property-menu');
    await expect(menu.getByRole('option')).toHaveText(['No estimate', '0 Points', '1 Point', '2 Points', '4 Points', '8 Points', '16 Points', '32 Points', '64 Points']);
    await expect(menu.getByRole('option', { name: '16 Points', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: info.outputPath('inline-imported-estimate.png') });
    await menu.getByRole('option', { name: '32 Points', exact: true }).click();
    await expect.poll(async () => (await f.saved()).estimate).toBe(32);
    await expect(page).toHaveURL(f.route);
    f.app.repo.update(f.actor, 'issues', f.issue.id, { estimate: 8 });
    f.app.repo.create(f.actor, 'issues', { title: 'Historical scale example', teamId: f.issue.teamId, estimate: 16 });
    await page.reload();
    await page.locator('.issue-row').filter({ hasText: 'Inline editing example' }).locator('[data-property="estimate"]').click();
    await expect(menu.getByRole('searchbox')).toHaveAttribute('aria-activedescendant', /option-5$/);
    await menu.getByRole('searchbox').press('Enter');
    await expect(menu).toHaveCount(0);
    expect((await f.saved()).estimate).toBe(8);
  } finally { await page.close(); await f.app.close(); }
});

test('optional dates, numeric and custom fields edit in place without losing custom metadata', async ({ page }) => {
  const f = await fixture(page);
  try {
    f.app.repo.update(f.actor, 'issues', f.issue.id, { startDate: '2026-09-01', timeEstimate: 10, customFields: { reference: { name: 'Reference', value: 'Old value' } } });
    await page.evaluate(key => { const display = JSON.parse(localStorage.getItem(key)!); display.properties = ['identifier', 'startDate', 'timeEstimate', 'customFields.reference']; localStorage.setItem(key, JSON.stringify(display)); }, f.key);
    await page.reload();
    for (const [label, value, expected] of [['Start date', '2026-09-10', '2026-09-10'], ['Time estimate', '15', 15], ['Reference', 'New value', 'New value']] as const) {
      await page.getByRole('button', { name: `Change ${label.toLowerCase()}`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `Edit ${label.toLowerCase()}`, exact: true });
      await dialog.getByLabel(label, { exact: true }).fill(value);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(f.route);
      await expect.poll(async () => { const issue = await f.saved(); return label === 'Start date' ? issue.startDate : label === 'Time estimate' ? issue.timeEstimate : issue.customFields.reference.value; }).toBe(expected);
    }
    expect((await f.saved()).customFields.reference.name).toBe('Reference');
  } finally { await page.close(); await f.app.close(); }
});

test('inline custom due date is staged, cancellable, validated, saved and removable', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    const open = async () => { await page.getByRole('button', { name: 'Change due date', exact: true }).click(); await page.getByRole('menuitem', { name: 'Custom…', exact: true }).click(); };
    await open();
    const dialog = page.getByRole('dialog', { name: 'Edit due date', exact: true });
    await expect(dialog.getByRole('textbox', { name: 'Due date' })).toHaveValue('09/30/2026');
    await expect(dialog.getByRole('grid')).toHaveCount(2);
    await dialog.locator('[data-due-day="2026-10-15"]').click();
    expect((await f.saved()).dueDate).toBe('2026-09-30');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(f.route);
    expect((await f.saved()).dueDate).toBe('2026-09-30');
    await open();
    await dialog.getByRole('textbox', { name: 'Due date' }).fill('02/31/2027');
    await dialog.getByRole('button', { name: 'Save due date', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('valid due date');
    await dialog.getByRole('textbox', { name: 'Due date' }).fill('10/15/2026');
    await page.screenshot({ path: info.outputPath('inline-custom-date.png') });
    await dialog.getByRole('button', { name: 'Save due date', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await f.saved()).dueDate).toBe('2026-10-15');
    await page.getByRole('button', { name: 'Change due date', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Remove due date/ }).click();
    await expect.poll(async () => (await f.saved()).dueDate).toBeNull();
    await expect(page).toHaveURL(f.route);
  } finally { await page.close(); await f.app.close(); }
});

test('inline due-date menus fit without horizontal scrollbars, including long searches and short windows', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    const menu = page.getByRole('menu', { name: 'Change due date', exact: true });
    for (const width of [1280, 960, 610, 320]) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.getByRole('button', { name: 'Change due date', exact: true }).click();
      await page.setViewportSize({ width, height: 800 });
      await expect(menu).toBeVisible();
      const size = await menu.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
      expect(size.scrollWidth, `horizontal overflow at ${width}px`).toBe(size.width);
      expect(size.scrollHeight, `unnecessary vertical scrolling at ${width}px`).toBe(size.height);
      const bounds = (await menu.boundingBox())!;
      for (const control of await menu.locator('input, [role="menuitem"]').all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      }
      await menu.getByRole('searchbox').fill('2026-09-30');
      expect(await menu.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
      await menu.getByRole('searchbox').fill('x'.repeat(160));
      await expect(menu).toContainText('Enter a date or duration');
      expect(await menu.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
      await menu.getByRole('searchbox').fill('');
      await page.screenshot({ path: info.outputPath(`due-menu-no-overflow-${width}.png`) });
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Change due date', exact: true }).click();
    await page.setViewportSize({ width: 610, height: 150 });
    await expect.poll(() => menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await menu.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
    await menu.getByRole('searchbox').press('End');
    await expect(menu.getByRole('menuitem').last()).toHaveAttribute('data-action-active', 'true');
    await page.keyboard.press('Escape');
    expect((await f.saved()).dueDate).toBe('2026-09-30');
    await expect(page).toHaveURL(f.route);
  } finally { await page.close(); await f.app.close(); }
});

test('inline pickers support keyboard dismissal and stay within a small viewport', async ({ page }) => {
  const f = await fixture(page);
  try {
    for (const width of [1280, 960, 610]) {
      await page.setViewportSize({ width, height: 440 });
      const trigger = page.locator('.issue-row [data-property="estimate"]');
      await trigger.focus(); await trigger.press('Enter');
      const menu = page.locator('.inline-issue-property-menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('searchbox')).toBeFocused();
      const bounds = (await menu.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(440);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(page).toHaveURL(f.route);
    }
    expect((await f.saved()).estimate).toBe(3);
  } finally { await page.close(); await f.app.close(); }
});
