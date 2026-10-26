import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Header Example', email: 'headers@example.test', password: 'isolated-header-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  const customer = app.repo.create(actor, 'customers', { name: 'Example customer' });
  const project = app.repo.create(actor, 'projects', { name: 'A project name long enough to exercise truncation in the shared column', teamIds: [team.id], directCustomerIds: [customer.id] });
  const issues: any[] = [];
  for (const [type, count] of [['started', 3], ['unstarted', 2], ['completed', 35]] as const) {
    const status = state.statuses.find((s: any) => s.teamId === team.id && s.type === type);
    for (let i = 0; i < count; i++) issues.push(app.repo.create(actor, 'issues', {
      title: `${type} issue ${i}`, teamId: team.id, statusId: status.id,
      priority: 2, assigneeId: state.user.id,
      ...(i % 2 === 0 ? { projectId: project.id, estimate: 4, dueDate: '2026-09-30' } : {}),
    }));
  }
  app.repo.update(actor, 'issues', issues[2].id, { parentId: issues[0].id });
  const view = app.repo.create(actor, 'views', { name: 'Aligned issue table', entityType: 'issues', filters: { match: 'all', conditions: [] }, display: {
    groupBy: 'statusId', showEmptyGroups: false, showSubIssues: true, nestedSubIssues: true, summaryOpen: false,
    properties: ['identifier', 'priority', 'estimate', 'statusId', 'labelIds', 'projectId', 'dueDate', 'effectiveCustomerIds', 'assigneeId', 'createdAt'],
    columnOrder: ['identifier', 'priority', 'estimate', 'statusId', 'title', 'labelIds', 'projectId', 'dueDate', 'effectiveCustomerIds', 'assigneeId', 'createdAt'],
  } });
  const snapshot = async () => (await (await page.request.get(url + '/api/v1/state')).json()).issues;
  const original = await snapshot();
  const route = url + '/view/' + view.id;
  await page.goto(route);
  await expect(page.locator('.issue-row').first()).toBeVisible();
  await page.addStyleTag({ content: '.issue-list-scroll::-webkit-scrollbar { width: 16px; height: 16px; }' });
  return { app, route, issues, view, actor, snapshot, original };
}

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit columns', exact: true }).click();
  await expect(page.locator('.issue-column-headers')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function alignment(page: Page) {
  return page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-column-header]'));
    const ids = headers.map(el => el.dataset.columnHeader);
    const errors: string[] = [];
    for (const row of document.querySelectorAll('.issue-row')) {
      const cells = Array.from(row.querySelectorAll<HTMLElement>('[data-column-cell]'));
      if (JSON.stringify(cells.map(cell => cell.dataset.columnCell)) !== JSON.stringify(ids)) errors.push('Cell order differs from headers');
      cells.forEach((cell, i) => {
        const box = cell.getBoundingClientRect(), header = headers[i]?.getBoundingClientRect();
        if (!header || Math.abs(box.x - header.x) > 0.5 || Math.abs(box.width - header.width) > 0.5) errors.push(`Misaligned ${cell.dataset.columnCell}`);
        for (const child of cell.children) {
          const content = child.getBoundingClientRect();
          if (content.width && (content.left < box.left - 0.5 || content.right > box.right + 0.5)) errors.push(`Overflowing ${cell.dataset.columnCell}`);
        }
      });
    }
    return errors;
  });
}

test('editable headers align with every field, including empty and nested rows, after reorder/hide/save', async ({ page }, info) => {
  await page.setViewportSize({ width: 2100, height: 1000 });
  const f = await fixture(page);
  try {
    await openEditor(page);
    const toolbar = page.locator('.issue-column-toolbar');
    const toolbarText = await toolbar.innerText();
    expect(toolbarText).toContain('Hidden columns');
    expect(toolbarText).not.toContain('Rearrange columns');
    expect(toolbarText).not.toContain('Drag a header');
    expect(toolbarText).not.toContain('Column settings');
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(50);
    await expect.poll(() => alignment(page)).toEqual([]);
    const empty = page.locator(`[data-issue-id="${f.issues[1].id}"]`);
    await expect(empty.locator('[data-column-cell="projectId"]')).toBeEmpty();
    await expect(empty.locator('[data-column-cell="effectiveCustomerIds"]')).toBeEmpty();
    await expect(empty.locator('[data-column-cell="estimate"]')).toBeEmpty();
    const titleBefore = (await page.locator('[data-column-header="title"]').boundingBox())!.x;
    const done = page.locator('.group-header').filter({ has: page.getByText('Done', { exact: true }) }).locator('.group-toggle');
    await done.click();
    await expect(done).toHaveAttribute('aria-expanded', 'false');
    expect((await page.locator('[data-column-header="title"]').boundingBox())!.x).toBe(titleBefore);
    await expect.poll(() => alignment(page)).toEqual([]);
    await page.locator('[data-column-id="projectId"]').dragTo(page.locator('[data-column-id="priority"]'), { targetPosition: { x: 2, y: 12 } });
    await expect(page.locator('[data-column-header]').nth(1)).toHaveAttribute('data-column-header', 'projectId');
    await expect.poll(() => alignment(page)).toEqual([]);
    await page.getByRole('button', { name: 'Hide Labels column', exact: true }).click();
    await expect(page.locator('[data-column-cell="labelIds"]')).toHaveCount(0);
    await expect.poll(() => alignment(page)).toEqual([]);
    // Existing field editors must still work inside cell slots, without opening the issue.
    const row = page.locator(`[data-issue-id="${f.issues[0].id}"]`);
    await row.getByRole('button', { name: 'Change due date', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Change due date', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.issue-column-headers')).toBeVisible();
    await expect(page).toHaveURL(f.route);
    for (const field of ['priority', 'statusId', 'estimate', 'projectId', 'assigneeId']) {
      await row.locator(`[data-property="${field}"]`).click();
      await expect(page.locator('.inline-issue-property-menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.issue-column-headers')).toBeVisible();
    }
    await row.getByRole('button', { name: 'Change customers', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Assign customers' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect.poll(() => f.app.repo.raw('views', f.view.id)!.display.columnOrder[1]).toBe('projectId');
    await page.screenshot({ path: info.outputPath('aligned-column-headers-wide.png') });
    await page.reload();
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
    await openEditor(page);
    await expect(page.locator('[data-column-header]').nth(1)).toHaveAttribute('data-column-header', 'projectId');
    await expect.poll(() => alignment(page)).toEqual([]);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});

test('column headers remain editable in empty lists and with every column hidden', async ({ page }) => {
  const f = await fixture(page);
  try {
    f.app.repo.update(f.actor, 'views', f.view.id,
      { filters: { match: 'all', conditions: [{ field: 'title', operator: 'contains', value: 'no matching title' }] } });
    await page.reload();
    await expect(page.locator('.issue-row')).toHaveCount(0);
    await openEditor(page);
    const count = await page.locator('.issue-column-visibility').count();
    for (let i = 0; i < count; i++) {
      await page.locator('.issue-column-visibility').first().click();
    }
    await expect(page.locator('[data-column-header]')).toHaveCount(0);
    await page.locator('.issue-columns-hidden > summary').click();
    await page.getByRole('button', { name: 'Show Issue title column', exact: true }).click();
    await expect(page.locator('[data-column-header="title"]')).toBeVisible();
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
  } finally { await page.close(); await f.app.close(); }
});

test('headers share horizontal scrolling, stay above virtualized groups, and support edge dragging', async ({ page }, info) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  const f = await fixture(page);
  try {
    await openEditor(page);
    const scroll = page.locator('.issue-list-scroll');
    expect(await scroll.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const headerTop = (await page.locator('.issue-column-headers').boundingBox())!.y;
    await scroll.evaluate(el => { el.scrollLeft = 500; el.scrollTop = 800; });
    await expect.poll(() => alignment(page)).toEqual([]);
    expect((await page.locator('.issue-column-headers').boundingBox())!.y).toBe(headerTop);
    const groupTop = await page.locator('.virtual-issue-list > div[style*="sticky"]').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().top));
    expect(groupTop.every(top => top >= headerTop + 40)).toBe(true);
    await page.screenshot({ path: info.outputPath('aligned-column-headers-scrolled.png') });
    await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
    const start = (await page.locator('[data-column-id="identifier"]').boundingBox())!;
    const bounds = (await scroll.boundingBox())!;
    await page.mouse.move(start.x + 12, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 24, start.y + 12, { steps: 12 });
    await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(180);
    await page.mouse.move(bounds.x + bounds.width / 2, start.y + 12);
    await page.mouse.up();
    await expect(page.locator('[data-column-header]').first()).not.toHaveAttribute('data-column-header', 'identifier');
    await expect.poll(() => alignment(page)).toEqual([]);
    await page.getByRole('button', { name: 'Save to View', exact: true }).click();
    await expect(page.locator('.issue-column-headers')).toHaveCount(0);
    expect(await scroll.evaluate(el => el.scrollLeft)).toBe(0);
    expect(await f.snapshot()).toEqual(f.original);
  } finally { await page.close(); await f.app.close(); }
});
