import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Resize Example', email: 'resize@example.test', password: 'isolated-resize-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const project = app.repo.create(actor, 'projects', { name: 'Example project', teamIds: [state.teams[0].id] });
  const issue = app.repo.create(actor, 'issues', { title: 'Resize these columns without losing their contents', teamId: state.teams[0].id, projectId: project.id, priority: 2, estimate: 4, assigneeId: state.user.id });
  app.repo.create(actor, 'issues', { title: 'Empty fields still occupy the same columns', teamId: state.teams[0].id });
  const view = app.repo.create(actor, 'views', { name: 'Resizable columns', entityType: 'issues', description: 'Preserve view metadata', filters: { match: 'all', conditions: [] }, display: {
    groupBy: 'none', orderBy: 'title', direction: 'asc', summaryOpen: false,
    properties: ['identifier', 'priority', 'statusId', 'projectId', 'estimate', 'createdAt', 'hideCustomers'],
    columnOrder: ['identifier', 'priority', 'statusId', 'estimate', 'title', 'projectId', 'createdAt'],
  } });
  const other = app.repo.create(actor, 'views', { name: 'Independent layout', entityType: 'issues', filters: view.filters, display: view.display });
  const route = url + '/view/' + view.id;
  const snapshot = async () => (await (await page.request.get(url + '/api/v1/state')).json()).issues;
  const original = await snapshot();
  await page.goto(route);
  const row = page.locator(`[data-issue-id="${issue.id}"]`);
  await expect(row).toBeVisible();
  await page.addStyleTag({ content: '.issue-list-scroll::-webkit-scrollbar { width:16px; height:16px }' });
  return { app, url, route, other, view, row, issue, snapshot, original, getView: () => app.repo.raw('views', view.id)! };
}

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit columns', exact: true }).click();
  await expect(page.locator('.issue-column-headers')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const header = (page: Page, id: string) => page.locator(`[data-column-header="${id}"]`);
const edge = (page: Page, id: string) => page.locator(`[data-column-resize="${id}"]`);
const width = async (page: Page, id: string) => (await header(page, id).boundingBox())!.width;
const ids = (page: Page) => page.locator('[data-column-header]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-column-header')!));
async function resize(page: Page, id: string, delta: number, release = true) {
  await edge(page, id).scrollIntoViewIfNeeded();
  const box = (await edge(page, id).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 8 });
  if (release) await page.mouse.up();
}
const cellWidths = (page: Page) => page.locator('.issue-row').first().locator('[data-column-cell]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute('data-column-cell'), node.getBoundingClientRect().width])));

test('dragging dividers adjusts spacing live, keeps it after Save/navigation/reload, and uses 14px headers', async ({ page }, info) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  const f = await fixture(page);
  try {
    await openEditor(page);
    const order = await ids(page);
    expect(await header(page, 'title').locator('.issue-column-handle').evaluate(el => getComputedStyle(el).fontSize)).toBe('14px');
    expect(await f.row.locator('.issue-row-title').evaluate(el => getComputedStyle(el).fontSize)).toBe('14px');
    expect(await edge(page, 'priority').evaluate(el => getComputedStyle(el).cursor)).toBe('col-resize');
    const originalTitleWidth = await width(page, 'title');
    const originalStatusX = (await header(page, 'statusId').boundingBox())!.x;
    await resize(page, 'priority', -40, false);
    expect(await width(page, 'priority')).toBe(48);
    expect(await width(page, 'title')).toBeCloseTo(originalTitleWidth, 0);
    expect((await header(page, 'statusId').boundingBox())!.x).toBe(originalStatusX - 40);
    await page.mouse.up();
    const projectX = (await header(page, 'projectId').boundingBox())!.x;
    await resize(page, 'title', -120);
    expect((await header(page, 'projectId').boundingBox())!.x).toBeCloseTo(projectX - 120, 0);
    expect(await ids(page)).toEqual(order);
    const widths = await cellWidths(page);
    for (const id of order) expect(widths[id]).toBe(await width(page, id));
    await page.screenshot({ path: info.outputPath('custom-column-spacing.png') });
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
    expect(await cellWidths(page)).toEqual(widths);
    await page.goto(f.url + '/view/' + f.other.id);
    await expect(page.locator('[data-column-cell]')).toHaveCount(0);
    await page.goto(f.route);
    await expect.poll(() => cellWidths(page)).toEqual(widths);
    await page.reload();
    await expect.poll(() => cellWidths(page)).toEqual(widths);
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('tab', { name: 'Board', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.board-card')).toHaveCount(2);
    await expect(page.locator('.issue-columns-aligned')).toHaveCount(0);
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('tab', { name: 'List', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => cellWidths(page)).toEqual(widths);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('full view editing stages widths on cancel and publishes them on Save', async ({ page }) => {
  const f = await fixture(page);
  try {
    const form = page.getByRole('form', { name: 'Edit view', exact: true });
    await page.goto(f.route + '/edit');
    await openEditor(page);
    await resize(page, 'estimate', 20);
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(f.getView().display.columnWidths).toBeUndefined();
    await expect(page.locator('[data-column-cell]')).toHaveCount(0);
    await page.goto(f.route + '/edit');
    await openEditor(page);
    await resize(page, 'estimate', 20);
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => f.getView().display.columnWidths?.estimate).toBe(100);
    await expect(page).toHaveURL(f.route);
    await expect(f.row.locator('[data-column-cell="estimate"]')).toHaveCSS('width', '100px');
    await f.row.locator('[data-property="priority"]').click();
    await expect(page.locator('.inline-issue-property-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(f.route);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('custom widths save to the view and follow hidden/reordered columns for a fresh client', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    await resize(page, 'projectId', 90);
    expect(await width(page, 'projectId')).toBe(266);
    await page.locator('[data-column-id="projectId"]').focus();
    await page.keyboard.press('Alt+Home');
    await page.getByRole('button', { name: 'Hide Project column', exact: true }).click();
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect.poll(() => f.getView().display.columnWidths?.projectId).toBe(266);
    expect(f.getView().display.columnOrder[0]).toBe('projectId');
    expect(f.getView().display.properties).not.toContain('projectId');
    expect(f.getView().display.orderBy).toBe('title');
    expect(f.getView().description).toBe(f.view.description);
    const freshContext = await browser.newContext({ storageState: { cookies: await page.context().cookies(), origins: [] } });
    try {
      const fresh = await freshContext.newPage();
      await fresh.goto(f.route);
      await expect(fresh.locator('[data-column-cell="title"]')).toHaveCount(2);
      await openEditor(fresh);
      await fresh.locator('.issue-columns-hidden > summary').click();
      await fresh.getByRole('button', { name: 'Show Project column', exact: true }).click();
      expect((await ids(fresh))[0]).toBe('projectId');
      expect(await width(fresh, 'projectId')).toBe(266);
      await edge(fresh, 'projectId').dblclick();
      expect((await ids(fresh))[0]).toBe('projectId');
      expect(await width(fresh, 'projectId')).toBe(176);
      await fresh.getByRole('button', { name: 'Save to View', exact: true }).click();
      await expect.poll(() => f.getView().display.columnWidths?.projectId).toBe(176);
      await fresh.reload();
      await expect(fresh.locator('[data-column-cell="projectId"]').first()).toHaveCSS('width', '176px');
    } finally { await freshContext.close(); }
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('resize cancellation, keyboard precision, limits and double-click reset do not reorder columns', async ({ page }) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    const order = await ids(page);
    await resize(page, 'priority', 80, false);
    expect(await width(page, 'priority')).toBe(168);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await width(page, 'priority')).toBe(88);
    expect(f.getView().display.columnWidths).toBeUndefined();
    await edge(page, 'priority').focus();
    await page.keyboard.press('ArrowRight');
    expect(await width(page, 'priority')).toBe(96);
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await width(page, 'priority')).toBe(95);
    await page.keyboard.press('Home');
    expect(await width(page, 'priority')).toBe(32);
    await page.keyboard.press('ArrowLeft');
    expect(await width(page, 'priority')).toBe(32);
    await edge(page, 'priority').dblclick();
    expect(await width(page, 'priority')).toBe(88);
    expect(await ids(page)).toEqual(order);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('resizing a horizontally scrolled column is exact and Save to View carries the widths', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 700 });
  const f = await fixture(page);
  try {
    await openEditor(page);
    await resize(page, 'projectId', 50);
    expect(await width(page, 'projectId')).toBe(226);
    expect(await page.locator('.issue-list-scroll').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(page).toHaveURL(f.route);
    await expect(page.locator('[data-column-cell="projectId"]').first()).toHaveCSS('width', '226px');
    await expect.poll(() => f.getView().display.columnWidths?.projectId).toBe(226);
    await page.reload();
    await expect(page.locator('[data-column-cell="projectId"]').first()).toHaveCSS('width', '226px');
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('Cancel and Escape restore widths, visibility and order to the opening layout, including earlier custom widths', async ({ page }) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    const originalOrder = await ids(page);
    await resize(page, 'priority', -40);
    await page.locator('[data-column-id="projectId"]').focus();
    await page.keyboard.press('Alt+Home');
    await page.getByRole('button', { name: 'Hide Status column', exact: true }).click();
    await page.locator('.issue-column-toolbar').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
    await expect(page.locator('[data-column-cell]')).toHaveCount(0);
    expect(f.getView().display).toEqual(f.view.display);
    await page.reload();
    await openEditor(page);
    expect(await ids(page)).toEqual(originalOrder);
    expect(await width(page, 'priority')).toBe(88);
    await resize(page, 'priority', -32);
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect.poll(() => f.getView().display.columnWidths?.priority).toBe(56);
    const savedWidths = await cellWidths(page);
    await openEditor(page);
    await resize(page, 'priority', 80);
    await page.keyboard.press('Escape');
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
    expect(await cellWidths(page)).toEqual(savedWidths);
    await page.reload();
    expect(await cellWidths(page)).toEqual(savedWidths);
    expect(f.getView().display.columnWidths.priority).toBe(56);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});
