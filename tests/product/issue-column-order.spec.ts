import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Column Example', email: 'columns@example.test', password: 'isolated-column-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  const customer = app.repo.create(actor, 'customers', { name: 'Example customer' });
  const project = app.repo.create(actor, 'projects', { name: 'Example project', teamIds: [team.id], directCustomerIds: [customer.id] });
  const issue = app.repo.create(actor, 'issues', { title: 'Arrange these columns', teamId: team.id, projectId: project.id, assigneeId: state.user.id, priority: 2, estimate: 3, dueDate: '2026-09-30', customFields: { reference: { name: 'Reference', value: 'ABC' } } });
  const route = url + '/profiles/' + state.user.id + '/created';
  const key = `display:${state.workspaceId}:${state.user.id}:profile:${state.user.id}:Created`;
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ groupBy: 'none', properties: ['identifier', 'priority', 'statusId', 'projectId', 'assigneeId', 'estimate', 'dueDate', 'createdAt', 'effectiveCustomerIds', 'customFields.reference'] })); }, key);
  await page.goto(route);
  const row = page.locator('.issue-row');
  await expect(row).toHaveCount(1);
  const snapshot = async () => (await (await page.request.get(url + '/api/v1/state')).json()).issues;
  const original = await snapshot();
  return { app, url, state, actor, issue, route, key, row, original, snapshot };
}
const editor = (page: Page) => page.getByRole('region', { name: 'Rearrange issue columns' });
const handle = (page: Page, id: string) => editor(page).locator(`[data-column-id="${id}"]`);
const openEditor = async (page: Page) => {
  await page.getByRole('button', { name: 'Edit columns', exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('.display-options')).toHaveCount(0);
};
const ids = (page: Page) => editor(page).locator('[data-column-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-column-id')));

test('Edit columns is a six-dot toolbar button immediately left of Filter, with keyboard focus restored on close', async ({ page }, info) => {
  const f = await savedViewFixture(page);
  try {
    for (const route of [f.route, f.route + '/edit', f.url + '/profiles/' + f.state.user.id + '/created', f.url + '/project/' + f.issue.projectId + '/issues']) {
      await page.goto(route);
      const trigger = page.getByRole('button', { name: 'Edit columns', exact: true });
      const controls = route.endsWith('/edit') ? page.getByRole('form', { name: 'Edit view', exact: true }) : page;
      const filter = controls.getByRole('button', { name: /^(Filter issues|Add filter)$/ });
      await expect(trigger).toBeVisible();
      await expect(trigger.locator('svg circle')).toHaveCount(6);
      const left = (await trigger.boundingBox())!, right = (await filter.boundingBox())!;
      expect(left.x + left.width).toBeLessThanOrEqual(right.x);
      expect(right.x - left.x - left.width).toBeLessThan(16);
      expect(left.y).toBe(right.y);
      expect(left.height).toBe(right.height);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await controls.getByRole('button', { name: 'Display options', exact: true }).click();
      await expect(page.locator('.display-options')).toBeVisible();
      await expect(page.locator('.display-options')).not.toContainText('Rearrange columns');
      await expect(page.locator('.display-options')).not.toContainText('Edit columns');
      await page.keyboard.press('Escape');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(editor(page)).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
    await page.screenshot({ path: info.outputPath('edit-columns-toolbar.png') });
    expect(await f.snapshot()).toEqual(f.original);
    expect(f.getView().display).toEqual(f.view.display);
  } finally { await page.close(); await f.app.close(); }
});

test('opt-in column drag changes actual row order, persists, and does not mutate issues', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await expect(editor(page)).toHaveCount(0);
    await openEditor(page);
    await expect.poll(() => ids(page)).toEqual(['priority', 'identifier', 'statusId', 'title', 'projectId', 'dueDate', 'estimate', 'effectiveCustomerIds', 'customFields.reference', 'assigneeId', 'createdAt']);
    await handle(page, 'projectId').dragTo(handle(page, 'priority'), { targetPosition: { x: 4, y: 12 } });
    await expect.poll(async () => (await ids(page))[0]).toBe('projectId');
    expect((await f.row.locator('.issue-project-badge').boundingBox())!.x).toBeLessThan((await f.row.locator('[data-property="priority"]').boundingBox())!.x);
    // A canceled or out-of-panel drag must never commit an arrangement.
    const initial = await ids(page);
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await openEditor(page);
    const start = (await handle(page, 'identifier').boundingBox())!;
    await page.mouse.move(start.x + 12, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(start.x + 70, start.y + 12, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await openEditor(page);
    expect(await ids(page)).toEqual(initial);
    const outsideStart = (await handle(page, 'identifier').boundingBox())!;
    await page.mouse.move(outsideStart.x + 12, outsideStart.y + 12);
    await page.mouse.down();
    await page.mouse.move(200, 600, { steps: 8 });
    await page.mouse.up();
    expect(await ids(page)).toEqual(initial);
    expect(await f.row.locator(':scope > .row-checkbox').count()).toBe(1);
    await page.screenshot({ path: info.outputPath('column-arrangement-open.png') });
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit columns', exact: true })).toBeFocused();
    await page.reload();
    await expect(editor(page)).toHaveCount(0);
    await expect(f.row.locator('.issue-project-badge')).toBeVisible();
    expect((await f.row.locator('.issue-project-badge').boundingBox())!.x).toBeLessThan((await f.row.locator('[data-property="priority"]').boundingBox())!.x);
    expect(await f.snapshot()).toEqual(f.original);
    await page.screenshot({ path: info.outputPath('column-arrangement-saved.png') });
  } finally { await page.close(); await f.app.close(); }
});

test('keyboard ordering includes title, customers and custom fields; cancellation and hidden-field positions work', async ({ page }) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    for (const id of ['title', 'effectiveCustomerIds', 'customFields.reference']) {
      await handle(page, id).focus();
      await page.keyboard.press('Alt+Home');
      await expect.poll(async () => (await ids(page))[0]).toBe(id);
      await expect(handle(page, id)).toBeFocused();
    }
    expect((await f.row.getByRole('button', { name: 'Change reference' }).boundingBox())!.x).toBeLessThan((await f.row.locator('.issue-row-title').boundingBox())!.x);
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('button', { name: 'Display effectiveCustomerIds', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(f.row.getByRole('button', { name: 'Change customers', exact: true })).toHaveCount(0);
    await openEditor(page);
    expect(await ids(page)).not.toContain('effectiveCustomerIds');
    await handle(page, 'identifier').focus();
    await page.keyboard.press('Alt+End');
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('button', { name: 'Display effectiveCustomerIds', exact: true }).click();
    await page.keyboard.press('Escape');
    await openEditor(page);
    expect((await ids(page)).slice(0, 3)).toEqual(['customFields.reference', 'effectiveCustomerIds', 'title']);
    const beforeCancel = await ids(page);
    await handle(page, 'priority').focus();
    await page.keyboard.press('Alt+Home');
    await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await openEditor(page);
    expect(await ids(page)).toEqual(beforeCancel);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('reordered fields still edit inline, and view switching keeps independent preferences', async ({ page }) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    await handle(page, 'estimate').focus();
    await page.keyboard.press('Alt+Home');
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await f.row.locator('[data-property="estimate"]').click();
    await page.locator('.inline-issue-property-menu').getByRole('option', { name: '5 Points', exact: true }).click();
    await expect.poll(async () => (await f.snapshot())[0].estimate).toBe(5);
    await expect(page).toHaveURL(f.route);
    await f.row.getByRole('button', { name: 'Change due date', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Change due date', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await f.row.getByRole('button', { name: 'Change customers', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Assign customers', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    // Client-side tab navigation must not copy this tab's preferences into Assigned.
    await page.getByRole('link', { name: 'Assigned', exact: true }).click();
    await openEditor(page);
    expect((await ids(page))[0]).toBe('priority');
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Created', exact: true }).click();
    await openEditor(page);
    expect((await ids(page))[0]).toBe('estimate');
  } finally { await page.close(); await f.app.close(); }
});

test('board layout and narrow windows remain usable without permanent rearranging chrome', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    await page.setViewportSize({ width: 720, height: 850 });
    const bounds = await editor(page).boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(720);
    expect(await editor(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('column-editor-narrow.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('tab', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit columns', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(editor(page)).toHaveCount(0);
    await expect(page.locator('.board-card')).toHaveCount(1);
    await expect(page.locator('.board-card')).toContainText('Arrange these columns');
  } finally { await page.close(); await f.app.close(); }
});

test('saved issue views retain local column order across reload and respect updated shared layouts', async ({ page }) => {
  const f = await fixture(page);
  try {
    const view = f.app.repo.create(f.actor, 'views', { name: 'Column view', entityType: 'issues', filters: { match: 'all', conditions: [] }, display: { groupBy: 'none', properties: ['priority', 'identifier', 'statusId', 'projectId', 'createdAt'] } });
    await page.goto(f.url + '/view/' + view.id);
    await expect(f.row).toHaveCount(1);
    await openEditor(page);
    await handle(page, 'identifier').focus();
    await page.keyboard.press('Alt+End');
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.reload();
    await openEditor(page);
    expect((await ids(page)).at(-1)).toBe('identifier');
    // A shared view edit should replace the old local structural settings.
    f.app.repo.update(f.actor, 'views', view.id, { display: { ...view.display, columnOrder: ['createdAt', 'title', 'priority', 'identifier', 'statusId', 'projectId'] } });
    await page.reload();
    await openEditor(page);
    expect((await ids(page)).slice(0, 2)).toEqual(['createdAt', 'title']);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('column chips hide and restore fields in place, persist, and synchronize with Display options', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await openEditor(page);
    await handle(page, 'priority').focus();
    await page.keyboard.press('Alt+End');
    const previousOrder = await ids(page);
    for (const [label, selector] of [['Priority', '[data-property="priority"]'], ['Customers', '.customer-assignment-control'], ['Issue title', '.issue-row-title']] as const) {
      await editor(page).getByRole('button', { name: `Hide ${label} column`, exact: true }).click();
      await expect(f.row.locator(selector)).toHaveCount(0);
      await expect(editor(page).locator('summary')).toBeFocused();
    }
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.reload();
    await expect(f.row.locator('[data-property="priority"], .customer-assignment-control, .issue-row-title')).toHaveCount(0);
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Display priority', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Display effectiveCustomerIds', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await openEditor(page);
    await editor(page).locator('summary').click();
    await page.screenshot({ path: info.outputPath('show-hidden-columns.png') });
    for (const label of ['Priority', 'Customers', 'Issue title']) await editor(page).getByRole('button', { name: `Show ${label} column`, exact: true }).click();
    await expect(f.row.locator('[data-property="priority"]')).toBeVisible();
    await expect(f.row.locator('.customer-assignment-control')).toBeVisible();
    await expect(f.row.locator('.issue-row-title')).toBeVisible();
    expect(await ids(page)).toEqual(previousOrder);
    // A field that was never enabled can also be added from this panel.
    await editor(page).getByRole('button', { name: 'Show Updated column', exact: true }).click();
    expect(await ids(page)).toContain('updatedAt');
    await page.setViewportSize({ width: 610, height: 580 });
    expect(await editor(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await page.locator('.issue-column-toolbar').boundingBox())!.height).toBeLessThanOrEqual(203);
    expect((await page.locator('.issue-list-scroll').boundingBox())!.height).toBeGreaterThan(100);
    await page.screenshot({ path: info.outputPath('column-visibility-narrow.png') });
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('project issue lists can hide their default-on effort column and show it again', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(f.url + '/project/' + f.issue.projectId + '/issues');
    await expect(f.row.locator('[data-property="estimate"]')).toBeVisible();
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Effort column', exact: true }).click();
    await expect(f.row.locator('[data-property="estimate"]')).toHaveCount(0);
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.reload();
    await expect(f.row.locator('[data-property="estimate"]')).toHaveCount(0);
    await openEditor(page);
    await editor(page).locator('summary').click();
    await editor(page).getByRole('button', { name: 'Show Effort column', exact: true }).click();
    await expect(f.row.locator('[data-property="estimate"]')).toBeVisible();
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

async function savedViewFixture(page: Page) {
  const f = await fixture(page);
  const view = f.app.repo.create(f.actor, 'views', { name: 'Persistent columns', entityType: 'issues', visibility: 'workspace', description: 'Keep this description', searchQuery: '', filters: { match: 'all', conditions: [{ field: 'projectId', operator: 'eq', value: f.issue.projectId }] }, display: { groupBy: 'none', orderBy: 'priority', direction: 'asc', summaryOpen: false, properties: ['identifier', 'priority', 'statusId', 'projectId', 'assigneeId', 'estimate', 'dueDate', 'createdAt', 'effectiveCustomerIds', 'customFields.reference'] } });
  const route = f.url + '/view/' + view.id;
  await page.goto(route);
  await expect(f.row).toHaveCount(1);
  const getView = () => f.app.repo.raw('views', view.id)!;
  return { ...f, view, route, getView };
}

test('Save to view stores column order and visibility in the database for a fresh client', async ({ page }, info) => {
  const f = await savedViewFixture(page);
  try {
    await openEditor(page);
    await handle(page, 'identifier').focus();
    await page.keyboard.press('Alt+End');
    await editor(page).getByRole('button', { name: 'Hide Priority column', exact: true }).click();
    await editor(page).getByRole('button', { name: 'Hide Customers column', exact: true }).click();
    await expect(editor(page).getByRole('button', { name: 'Save to View', exact: true })).toBeEnabled();
    expect(f.getView().display).toEqual(f.view.display);
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect.poll(() => f.getView().display.properties).toContain('hideCustomers');
    expect(f.getView().display.properties).not.toContain('priority');
    expect(f.getView().display.columnOrder.at(-1)).toBe('identifier');
    expect(f.getView().filters).toEqual(f.view.filters);
    expect(f.getView().description).toBe(f.view.description);
    expect(f.getView().display.groupBy).toBe('none');
    expect(f.getView().display.orderBy).toBe('priority');
    await expect(page.locator('.issue-column-save-bar')).toHaveCount(0);
    const context = await page.context().browser()!.newContext({ storageState: { cookies: await page.context().cookies(), origins: [] } });
    try {
      const fresh = await context.newPage();
      await fresh.goto(f.route);
      await expect(fresh.locator('.issue-row')).toHaveCount(1);
      await expect(fresh.locator('.issue-row [data-property="priority"], .issue-row .customer-assignment-control')).toHaveCount(0);
      await openEditor(fresh);
      expect((await ids(fresh)).at(-1)).toBe('identifier');
      await expect(editor(fresh).getByRole('button', { name: 'Save to View', exact: true })).toBeEnabled();
      await fresh.screenshot({ path: info.outputPath('saved-columns-fresh-client.png') });
      await handle(fresh, 'title').focus();
      await fresh.keyboard.press('Alt+Home');
      await editor(fresh).getByRole('button', { name: 'Save to View', exact: true }).click();
      await expect.poll(() => f.getView().display.columnOrder.indexOf('title') < f.getView().display.columnOrder.indexOf('statusId')).toBe(true);
      expect(f.getView().display.properties).toContain('hideCustomers');
    } finally { await context.close(); }
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('toolbar only offers Save to View and Cancel, and Cancel restores order and visibility', async ({ page }, info) => {
  const f = await savedViewFixture(page);
  try {
    await openEditor(page);
    const originalOrder = await ids(page);
    await expect(page.locator('.issue-column-toolbar-actions button')).toHaveText(['Save to View', 'Cancel']);
    await editor(page).locator('summary').click();
    expect(await page.locator('.issue-column-show').count()).toBeGreaterThan(0);
    await expect(page.locator('.issue-column-show .icon')).toHaveCount(await page.locator('.issue-column-show').count());
    await page.screenshot({ path: info.outputPath('simplified-column-controls.png') });
    await handle(page, 'title').focus();
    await page.keyboard.press('Alt+Home');
    await editor(page).getByRole('button', { name: 'Hide Owner column', exact: true }).click();
    await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(page).toHaveURL(f.route);
    await expect(f.row.locator('[data-property="assigneeId"]')).toBeVisible();
    await page.reload();
    await openEditor(page);
    expect(await ids(page)).toEqual(originalOrder);
    expect(f.getView().display).toEqual(f.view.display);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('full view editing saves column settings and cancellation does not publish them', async ({ page }) => {
  const f = await savedViewFixture(page);
  try {
    await page.goto(f.route + '/edit');
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Priority column', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(f.route + '/edit');
    await expect(page.getByRole('button', { name: 'Edit columns', exact: true })).toBeFocused();
    await page.getByRole('form', { name: 'Edit view', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(f.getView().display).toEqual(f.view.display);
    await page.goto(f.route + '/edit');
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Priority column', exact: true }).click();
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await page.getByRole('form', { name: 'Edit view', exact: true }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => f.getView().display.properties.includes('priority')).toBe(false);
    await expect(page).toHaveURL(f.route);
  } finally { await page.close(); await f.app.close(); }
});

test('offline view column saves sync on reconnect and rejected saves show a retryable error', async ({ page }) => {
  const f = await savedViewFixture(page);
  try {
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Priority column', exact: true }).click();
    await page.context().setOffline(true);
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    expect(f.getView().display.properties).toContain('priority');
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => f.getView().display.properties.includes('priority')).toBe(false);
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Owner column', exact: true }).click();
    await page.route('**/api/v1/batch', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_REJECTED', message: 'Test save rejected' } }) }));
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(page.locator('.issue-column-save-bar').getByRole('alert')).toContainText('Test save rejected');
    expect(f.getView().display.properties).toContain('assigneeId');
    await page.unroute('**/api/v1/batch');
    await page.locator('.issue-column-save-bar').getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect.poll(() => f.getView().display.properties.includes('assigneeId')).toBe(false);
    await expect(page.locator('.issue-column-save-bar').getByRole('alert')).toHaveCount(0);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.context().setOffline(false); await page.close(); await f.app.close(); }
});

test('Cancel can discard a rejected column save without leaving it queued', async ({ page }) => {
  const f = await savedViewFixture(page);
  try {
    await openEditor(page);
    await editor(page).getByRole('button', { name: 'Hide Owner column', exact: true }).click();
    await page.route('**/api/v1/batch', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_REJECTED', message: 'Test save rejected' } }) }));
    await editor(page).getByRole('button', { name: 'Save to View', exact: true }).click();
    const bar = page.locator('.issue-column-save-bar');
    await expect(bar.getByRole('alert')).toContainText('Test save rejected');
    await bar.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(bar).toHaveCount(0);
    await expect(f.row.locator('[data-property="assigneeId"]')).toBeVisible();
    await page.unroute('**/api/v1/batch');
    await page.reload();
    await expect(f.row.locator('[data-property="assigneeId"]')).toBeVisible();
    expect(f.getView().display).toEqual(f.view.display);
  } finally { await page.close(); await f.app.close(); }
});
