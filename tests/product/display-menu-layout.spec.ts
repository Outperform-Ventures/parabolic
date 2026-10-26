import { test, expect, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function expectLayoutFits(panel: Locator) {
  // Read all geometry in one frame; dropdown positioning responds to resize.
  await expect(async () => {
    const layout = await panel.evaluate(el => {
      const bounds = (node: Element) => {
        const { left, right, top, bottom } = node.getBoundingClientRect();
        return { left, right, top, bottom };
      };
      const tabs = el.querySelector('[role="tablist"]')!;
      const outer = el.parentElement!;
      return {
        tabs: bounds(tabs), outer: bounds(outer), width: innerWidth, height: innerHeight,
        overflow: outer.scrollWidth - outer.clientWidth,
        buttons: [...tabs.querySelectorAll('[role="tab"]')].map(button => {
          const label = button.querySelector('span')!;
          return { ...bounds(button), labelFits: label.scrollWidth <= label.clientWidth + 1 };
        }),
        next: bounds(el.querySelector('.display-row')!),
      };
    });
    expect(layout.buttons).toHaveLength(4);
    for (const box of layout.buttons) {
      expect(box.left).toBeGreaterThanOrEqual(layout.tabs.left);
      expect(box.right).toBeLessThanOrEqual(layout.tabs.right + 0.5);
      expect(box.bottom, 'tab must stay inside the tablist').toBeLessThanOrEqual(layout.tabs.bottom + 0.5);
      expect(box.labelFits).toBe(true);
    }
    expect(layout.next.top - Math.max(...layout.buttons.map(box => box.bottom)), 'view tabs must not overlap grouping/sorting controls').toBeGreaterThanOrEqual(12);
    expect(layout.overflow).toBe(0);
    expect(layout.outer.left).toBeGreaterThanOrEqual(7);
    expect(layout.outer.right).toBeLessThanOrEqual(layout.width - 7);
    expect(layout.outer.bottom).toBeLessThanOrEqual(layout.height - 7);
  }).toPass({ timeout: 2000 });
}

test('display menu contains all four layouts without overlapping controls on saved, team and member views', async ({ page }, info) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Display reviewer', email: 'display-layout@example.test', password: 'isolated-display-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const view = app.repo.create(actor, 'views', { name: 'Layout review', entityType: 'issues', visibility: 'workspace', filters: { match: 'all', conditions: [] }, display: { layout: 'list', groupBy: 'statusId' } });
    const routes = ['/view/' + view.id, '/team/' + state.teams[0].id + '/active', '/profiles/' + state.user.id + '/created'];
    for (const [index, route] of routes.entries()) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url + route);
      await page.addStyleTag({ content: '::-webkit-scrollbar{width:16px;height:16px}' });
      await page.getByRole('button', { name: 'Display options', exact: true }).click();
      const panel = page.locator('.display-options');
      await expect(panel).toBeVisible();
      for (const [width, height] of [[1280, 900], [610, 600], [320, 420]]) {
        await page.setViewportSize({ width, height });
        await expectLayoutFits(panel);
        await page.screenshot({ path: info.outputPath(`display-${index}-${width}.png`) });
      }
      await page.keyboard.press('Escape');
    }
  } finally { await page.close(); await app.close(); }
});

test('layout tabs and sorting remain clickable, keyboard accessible and persistent', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Sort reviewer', email: 'sort-layout@example.test', password: 'isolated-display-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    for (const title of ['Alpha issue', 'Zulu issue']) app.repo.create(actor, 'issues', { title, teamId: state.teams[0].id });
    await page.goto(url + '/team/' + state.teams[0].id + '/all');
    const trigger = page.getByRole('button', { name: 'Display options', exact: true });
    await trigger.click();
    const panel = page.locator('.display-options');
    for (const name of ['Calendar', 'Timeline / Gantt', 'Board', 'List']) {
      await panel.getByRole('tab', { name, exact: true }).click();
      await expect(panel.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expectLayoutFits(panel);
    }
    await panel.getByRole('tab', { name: 'List', exact: true }).press('End');
    await expect(panel.getByRole('tab', { name: 'Timeline / Gantt', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(panel.getByRole('tab', { name: 'List', exact: true })).toBeFocused();
    await panel.getByLabel('Grouping', { exact: true }).selectOption('none');
    await panel.getByLabel('Ordering', { exact: true }).selectOption('title');
    await page.keyboard.press('Escape');
    await expect(page.locator('.issue-row-title')).toHaveText(['Alpha issue', 'Zulu issue']);
    await page.reload();
    await trigger.click();
    await expect(panel.getByLabel('Ordering', { exact: true })).toHaveValue('title');
    await expectLayoutFits(panel);
  } finally { await page.close(); await app.close(); }
});
