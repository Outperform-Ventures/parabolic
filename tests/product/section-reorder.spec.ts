import { test, expect, type Page, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Section tester', email: 'sections@example.test', password: 'isolated-section-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  const project = app.repo.create(actor, 'projects', { name: 'Section project', teamIds: [team.id] });
  const customer = app.repo.create(actor, 'customers', { name: 'Section customer' });
  const issues = ['started', 'unstarted', 'backlog', 'completed'].map((type, index) => {
    const status = state.statuses.find((s: any) => s.teamId === team.id && s.type === type);
    return app.repo.create(actor, 'issues', { title: type + ' example', teamId: team.id, statusId: status.id, projectId: project.id, directCustomerIds: [customer.id], assigneeId: index % 2 ? null : state.user.id, priority: index % 2 ? 2 : 1 });
  });
  const view = app.repo.create(actor, 'views', { name: 'MASTER ISSUE VIEW', entityType: 'issues', filters: { match: 'all', conditions: [] }, display: { groupBy: 'statusId', subGroupBy: 'none', layout: 'list', showCompleted: true, showEmpty: true } });
  const route = url + '/view/' + view.id;
  await page.goto(route);
  await expect(header(page, 'Done')).toBeVisible();
  const snapshot = async () => {
    const data = await (await page.request.get(url + '/api/v1/state')).json();
    return { issues: data.issues, projects: data.projects, statuses: data.statuses };
  };
  return { app, url, actor, state, team, project, customer, issues, view, route, snapshot };
}
const header = (page: Page, name: string) => page.locator('.group-header').filter({ has: page.locator('strong').getByText(name, { exact: true }) });
const names = (page: Page) => page.locator('.group-header:not(.issue-subgroup-header) > strong').allTextContents();
async function dragBefore(source: Locator, target: Locator, horizontal = false) {
  await source.hover();
  await source.locator('.section-reorder-handle').dragTo(target, { targetPosition: horizontal ? { x: 4, y: 18 } : { x: 150, y: 4 } });
}
async function display(page: Page, primary: string, secondary = 'none', layout = 'List') {
  await page.getByRole('button', { name: 'Display options', exact: true }).click();
  await page.getByLabel('Grouping', { exact: true }).selectOption(primary);
  await page.getByLabel('Sub-grouping', { exact: true }).selectOption(secondary);
  await page.getByRole('tab', { name: layout, exact: true }).click();
  await page.keyboard.press('Escape');
}

test('drag insertion markers are straight full-span lines, not rounded outlines', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await header(page, 'Done').locator('.group-toggle').click({ modifiers: ['Alt'] });
    for (const layout of ['List', 'Board']) {
      if (layout === 'Board') await display(page, 'statusId', 'none', layout);
      for (const edge of ['before', 'after']) {
        const source = header(page, 'Todo'), target = header(page, 'In Progress');
        await source.hover();
        const grip = (await source.locator('.section-reorder-handle').boundingBox())!;
        const box = (await target.boundingBox())!;
        await page.mouse.move(grip.x + 10, grip.y + 12);
        await page.mouse.down();
        const x = layout === 'Board' ? box.x + (edge === 'before' ? 4 : box.width - 4) : box.x + 150;
        const y = layout === 'Board' ? box.y + 18 : box.y + (edge === 'before' ? 4 : box.height - 4);
        await page.mouse.move(x, y, { steps: 12 });
        await page.mouse.move(x, y);
        await expect(target).toHaveAttribute('data-section-drop', edge);
        const marker = await target.evaluate(el => {
          const style = getComputedStyle(el), line = getComputedStyle(el, '::after');
          return { shadow: style.boxShadow, radius: style.borderRadius, width: el.clientWidth, height: el.clientHeight,
            lineWidth: parseFloat(line.width), lineHeight: parseFloat(line.height), lineRadius: line.borderRadius,
            pointerEvents: line.pointerEvents, top: line.top, bottom: line.bottom, left: line.left, right: line.right };
        });
        expect(marker.shadow).toBe('none');
        expect(marker.lineRadius).toBe('0px');
        expect(marker.pointerEvents).toBe('none');
        if (layout === 'List') {
          expect(parseFloat(marker.radius)).toBeGreaterThan(0);
          expect(marker.lineWidth).toBe(marker.width);
          expect(marker.lineHeight).toBe(2);
          expect(edge === 'before' ? marker.top : marker.bottom).toBe('0px');
        } else {
          expect(marker.lineHeight).toBe(marker.height);
          expect(marker.lineWidth).toBe(2);
          expect(edge === 'before' ? marker.left : marker.right).toBe('0px');
        }
        await page.screenshot({ path: info.outputPath(`straight-insertion-${layout.toLowerCase()}-${edge}.png`) });
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(page.locator('[data-section-drop]')).toHaveCount(0);
      }
    }
  } finally { await page.close(); await f.app.close(); }
});

test('collapsed sections drag directly, persist on return/reload, and can be saved with the view', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    const original = await f.snapshot();
    await header(page, 'Done').locator('.group-toggle').click({ modifiers: ['Alt'] });
    await dragBefore(header(page, 'Done'), header(page, 'In Progress'));
    await expect.poll(() => names(page)).toEqual(['Done', 'In Progress', 'Todo', 'Backlog', 'Canceled', 'Triage']);
    await expect(page.locator('.group-toggle[aria-expanded="true"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'My issues', exact: true }).click();
    await page.goBack();
    await expect.poll(async () => (await names(page))[0]).toBe('Done');
    await page.reload();
    await expect.poll(async () => (await names(page))[0]).toBe('Done');
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('button', { name: 'Group ordering', exact: true }).click();
    await expect(page.locator('.issue-group-order-row').first()).toContainText('Done');
    await page.getByRole('button', { name: 'Save order to view', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await (await page.request.get(f.url + '/api/v1/state')).json()).views.find((v: any) => v.id === f.view.id).display.groupOrders?.statusId?.length).toBe(6);
    const session = await page.context().storageState();
    const fresh = await browser.newContext({ storageState: { cookies: session.cookies, origins: [] } });
    try {
      const other = await fresh.newPage();
      await other.goto(f.route);
      await expect.poll(async () => (await names(other))[0]).toBe('Done');
    } finally { await fresh.close(); }
    expect(await f.snapshot()).toEqual(original);
  } finally { await page.close(); await f.app.close(); }
});

test('group order is independent across views and grouping fields, including scoped issue pages', async ({ page }) => {
  const f = await fixture(page);
  try {
    const original = await f.snapshot();
    await dragBefore(header(page, 'Done'), header(page, 'In Progress'));
    for (const route of ['/team/' + f.team.id + '/all', '/project/' + f.project.id + '/issues', '/profiles/' + f.state.user.id]) {
      await page.goto(f.url + route);
      await display(page, 'statusId');
      const prior = await names(page);
      expect(prior[0]).not.toBe('Done');
      // Use a section that exists even on member views with unassigned Done.
      const last = prior.at(-1)!;
      await dragBefore(header(page, last), header(page, prior[0]));
      await page.reload();
      await expect.poll(async () => (await names(page))[0]).toBe(last);
    }
    await page.goto(f.route);
    await expect.poll(async () => (await names(page))[0]).toBe('Done');
    await display(page, 'priority');
    await dragBefore(header(page, 'High'), header(page, 'Urgent'));
    await expect.poll(async () => (await names(page))[0]).toBe('High');
    await display(page, 'statusId');
    await expect.poll(async () => (await names(page))[0]).toBe('Done');
    await display(page, 'priority');
    await expect.poll(async () => (await names(page))[0]).toBe('High');
    await page.goto(f.url + '/customer/' + f.customer.id);
    await page.getByRole('button', { name: 'Issues', exact: true }).click();
    await display(page, 'statusId');
    await page.locator('.group-toggle').first().click({ modifiers: ['Alt'] });
    const customerOrder = await names(page);
    await dragBefore(header(page, customerOrder.at(-1)!), header(page, customerOrder[0]));
    await expect.poll(async () => (await names(page))[0]).toBe(customerOrder.at(-1));
    await page.getByRole('link', { name: f.customer.name, exact: true }).click();
    await page.getByRole('button', { name: 'Issues', exact: true }).click();
    await expect.poll(async () => (await names(page))[0]).toBe(customerOrder.at(-1));
    expect(await f.snapshot()).toEqual(original);
  } finally { await page.close(); await f.app.close(); }
});

test('nested sections and board headers reorder; issue dragging remains a separate operation', async ({ page }) => {
  const f = await fixture(page);
  try {
    await display(page, 'priority', 'statusId');
    const child = (name: string) => page.locator('.issue-subgroup-header').filter({ has: page.getByText(name, { exact: true }) });
    await dragBefore(child('Backlog'), child('In Progress'));
    await expect.poll(() => page.locator('.issue-subgroup-header > strong').allTextContents()).toEqual(['Backlog', 'In Progress', 'Todo', 'Done']);
    await page.reload();
    await expect.poll(async () => (await page.locator('.issue-subgroup-header > strong').allTextContents())[0]).toBe('Backlog');
    await display(page, 'priority', 'statusId', 'Board');
    const rowHeaders = page.locator('.swimlane-row-label');
    await expect(rowHeaders.first()).toContainText('Backlog');
    await rowHeaders.first().locator('.section-reorder-handle').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(rowHeaders.first()).toContainText('In Progress');
    await page.reload();
    await expect(rowHeaders.first()).toContainText('In Progress');
    await display(page, 'priority', 'statusId');
    const before = await f.snapshot();
    // Incompatible level, outside drop, and Escape must not mutate or reorder.
    const ordering = await names(page);
    await dragBefore(child('Backlog'), header(page, 'High'));
    expect(await names(page)).toEqual(ordering);
    await header(page, 'Urgent').hover();
    const box = (await header(page, 'Urgent').locator('.section-reorder-handle').boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 70, { steps: 8 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    expect(await names(page)).toEqual(ordering);
    await display(page, 'statusId', 'none', 'Board');
    await dragBefore(header(page, 'Todo'), header(page, 'In Progress'), true);
    await expect.poll(async () => (await names(page))[0]).toBe('Todo');
    expect(await f.snapshot()).toEqual(before);
    const moving = f.issues[0];
    await page.locator(`.board-card[data-issue-id="${moving.id}"]`).dragTo(header(page, 'Todo'));
    const todo = f.state.statuses.find((s: any) => s.teamId === f.team.id && s.type === 'unstarted');
    await expect.poll(async () => (await f.snapshot()).issues.find((i: any) => i.id === moving.id).statusId).toBe(todo.id);
  } finally { await page.close(); await f.app.close(); }
});

test('project list and board sections support persistent drag and keyboard ordering', async ({ page }) => {
  const f = await fixture(page);
  try {
    const original = await f.snapshot();
    await page.goto(f.url + '/projects');
    await page.getByRole('button', { name: 'Project display options', exact: true }).click();
    await page.getByLabel('Project grouping', { exact: true }).selectOption('status');
    await page.keyboard.press('Escape');
    const sections = page.locator('.project-section-header');
    const order = () => sections.locator('strong').allTextContents();
    const start = await order();
    expect(start.length).toBeGreaterThan(1);
    await dragBefore(sections.last(), sections.first());
    await expect.poll(async () => (await order())[0]).toBe(start.at(-1));
    await page.reload();
    await expect.poll(async () => (await order())[0]).toBe(start.at(-1));
    await sections.first().locator('.section-reorder-handle').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await order())[1]).toBe(start.at(-1));
    const arranged = await order();
    await page.getByRole('button', { name: 'Project display options', exact: true }).click();
    await page.getByRole('button', { name: 'Board layout', exact: true }).click();
    await page.keyboard.press('Escape');
    const board = page.locator('.feature-board-column > h3');
    await expect(board.first()).toContainText(arranged[0]);
    await dragBefore(board.nth(1), board.first(), true);
    await page.reload();
    await expect(board.first()).toContainText(arranged[1]);
    expect(await f.snapshot()).toEqual(original);
  } finally { await page.close(); await f.app.close(); }
});
