import { test, expect, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

// Reproduce macOS “Always show scroll bars”, not Chromium's hidden test bars.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function expectNoHorizontalOverflow(container: Locator) {
  for (const node of await container.all()) {
    await expect(node).toBeVisible();
    const size = await node.evaluate(el => ({
      name: el.className, width: el.clientWidth, scrollWidth: el.scrollWidth,
      horizontal: getComputedStyle(el).overflowX,
    }));
    expect(size.scrollWidth, JSON.stringify(size)).toBe(size.width);
  }
}

test('filter cascades fit without horizontal scrollbars, including vertically scrolling windows', async ({ page }, info) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Menu reviewer', email: 'menus@example.test', password: 'isolated-menu-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    await page.goto(url + '/team/' + state.teams[0].id + '/all');
    await page.addStyleTag({ content: '::-webkit-scrollbar { width:16px; height:16px; }' });
    const trigger = page.getByRole('button', { name: 'Filter issues', exact: true });
    const panels = page.locator('.filter-cascade-panel');
    const options = panels.locator('.issue-filter-options');
    for (const [width, height] of [[1280, 1100], [610, 720], [320, 320]]) {
      await page.setViewportSize({ width: 1280, height: 1100 });
      await trigger.click();
      await page.setViewportSize({ width, height });
      await expectNoHorizontalOverflow(options);
      await expectNoHorizontalOverflow(panels);
      if (height === 1100) expect(await options.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
      if (height === 320) expect(await options.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      // The bottom option must remain reachable by keyboard in a short window.
      await panels.getByRole('textbox').press('ArrowDown');
      await page.keyboard.press('End');
      await expect(panels.getByRole('menuitem', { name: 'Template', exact: true })).toBeFocused();
      await page.screenshot({ path: info.outputPath(`filter-${width}.png`) });
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Customers', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Customer revenue', exact: true }).click();
    await expect(panels).toHaveCount(3);
    await expectNoHorizontalOverflow(options);
    await expectNoHorizontalOverflow(panels);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
    // Entering a panel directly over a row still opens its flyout after resizing.
    await trigger.click();
    await panels.getByRole('textbox').fill('Dates');
    await page.mouse.move(0, 0);
    await page.getByRole('menuitem', { name: 'Dates', exact: true }).hover();
    await expect(panels).toHaveCount(2);
    await expectNoHorizontalOverflow(options);
    await page.keyboard.press('Escape');
    await trigger.click();
    await panels.getByRole('textbox').fill('x'.repeat(160));
    await expectNoHorizontalOverflow(options);
    await expectNoHorizontalOverflow(panels);
  } finally { await page.close(); await app.close(); }
});

test('shared dropdowns and inline pickers stay contained with long labels and visible scrollbars', async ({ page }, info) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Menu reviewer', email: 'picker-menus@example.test', password: 'isolated-menu-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const project = app.repo.create(actor, 'projects', { name: 'Project with a very long name '.repeat(5), teamIds: [state.teams[0].id] });
    for (let i = 0; i < 20; i++) app.repo.create(actor, 'projects', { name: `Project ${i} ` + 'LongName'.repeat(12), teamIds: [state.teams[0].id] });
    app.repo.create(actor, 'issues', { title: 'Menu containment', teamId: state.teams[0].id, projectId: project.id, assigneeId: state.user.id, priority: 2, estimate: 4, dueDate: '2026-09-30' });
    const key = `display:${state.workspaceId}:${state.user.id}:profile:${state.user.id}:Created`;
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ groupBy: 'none', properties: ['identifier', 'priority', 'statusId', 'projectId', 'assigneeId', 'estimate', 'dueDate'] })), key);
    await page.goto(url + '/profiles/' + state.user.id + '/created');
    await page.addStyleTag({ content: '::-webkit-scrollbar { width:16px; height:16px; }' });
    for (const property of ['priority', 'statusId', 'projectId', 'assigneeId', 'estimate']) {
      await page.locator(`.issue-row [data-property="${property}"]`).first().click();
      const menu = page.locator('.inline-issue-property-menu');
      for (const [width, height] of [[1280, 720], [320, 180]]) {
        await page.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(menu);
        await expectNoHorizontalOverflow(menu.locator('.menu-scroll'));
      }
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await page.getByRole('button', { name: 'Change due date', exact: true }).click();
    await expectNoHorizontalOverflow(page.locator('.inline-due-date-menu'));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await expectNoHorizontalOverflow(page.locator('.dropdown-content'));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More workspace views', exact: true }).click();
    const more = page.locator('.dropdown-content:has(.sidebar-menu-content)');
    await expectNoHorizontalOverflow(more);
    expect(await more.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: / Workspace Menu$/ }).click();
    const workspace = page.getByRole('menu', { name: 'Workspace actions', exact: true });
    await expectNoHorizontalOverflow(workspace);
    expect(await workspace.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
    await workspace.getByRole('menuitem', { name: /^Switch workspace/ }).click();
    await expectNoHorizontalOverflow(page.locator('.workspace-popup'));
    await page.screenshot({ path: info.outputPath('workspace-menus.png') });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: `${state.teams[0].name} menu`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Subscribe', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expectNoHorizontalOverflow(page.locator('.sidebar-subscribe-menu'));
    await expect(page.getByRole('checkbox', { name: 'An issue is added to the team', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.sidebar-subscribe-menu')).toHaveCount(0);
  } finally { await page.close(); await app.close(); }
});

test('customer editor choice menus preserve vertical scrolling without horizontal overflow', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Customer menu reviewer', email: 'customer-menus@example.test', password: 'isolated-menu-test' } });
    const response = await page.request.post(url + '/api/v1/customers', { data: { name: 'Menu fixture customer' } });
    expect(response.ok()).toBe(true);
    const customer = await response.json();
    await page.goto(url + '/customer/' + customer.id);
    await page.addStyleTag({ content: '::-webkit-scrollbar { width:16px; height:16px; }' });
    await page.getByRole('button', { name: 'Edit customer', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit customer', exact: true });
    await editor.getByRole('combobox', { name: 'Status', exact: true }).click();
    const status = page.locator('.customer-status-menu');
    await expectNoHorizontalOverflow(status);
    expect(await status.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
    await page.setViewportSize({ width: 610, height: 96 });
    await expectNoHorizontalOverflow(status);
    await expect.poll(() => status.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 720 });
    await editor.locator('.customer-owner-trigger').click();
    await expectNoHorizontalOverflow(page.locator('.dropdown-content'));
    await page.keyboard.press('Escape');
  } finally { await page.close(); await app.close(); }
});
