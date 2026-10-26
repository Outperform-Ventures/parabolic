import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

test('sidebar labels and headings use 14px without changing helpers or overflowing', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Typography reviewer', email: 'sidebar-font@example.test', password: 'isolated-font-test',
      workspaceName: 'A workspace with a deliberately long name',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const team = state.teams[0];
    await page.request.patch(url + '/api/v1/teams/' + team.id, { data: {
      name: 'A deliberately long team name', version: team.version,
    } });
    await page.request.post(url + '/api/v1/favorites', { data: {
      type: 'team', entityKind: 'teams', entityId: team.id, section: 'active',
      label: 'Active issues A deliberately long team name', route: '/team/' + team.id + '/active',
    } });
    await page.goto(url + '/my-issues');
    const sidebar = page.locator('.sidebar');
    const teamButton = sidebar.locator('.team-heading > button:first-child').first();
    if (await teamButton.getAttribute('aria-expanded') === 'false') await teamButton.click();
    await expect(sidebar.locator('.team-links .sidebar-link').first()).toBeVisible();

    for (const width of [1280, 864, 610]) {
      await page.setViewportSize({ width, height: 800 });
      const labels = sidebar.locator('.workspace-name strong, .sidebar-link > span:not(.sidebar-count):not(.sidebar-shortcut-hint), .team-heading strong, .favorite-team-suffix');
      for (const label of await labels.all()) {
        if (!await label.isVisible()) continue;
        await expect(label).toHaveCSS('font-size', '14px');
        await expect(label).toHaveCSS('white-space', 'nowrap');
      }
      for (const name of ['Workspace', 'Favorites', 'Your teams']) {
        const heading = sidebar.getByRole('button', { name, exact: true });
        await expect(heading).toHaveCSS('font-size', '14px');
        const bounds = (await sidebar.boundingBox())!, box = (await heading.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(box.height).toBeLessThanOrEqual(28);
      }
      const initiatives = sidebar.getByRole('link', { name: 'Initiatives', exact: true });
      await initiatives.hover();
      const hint = initiatives.locator('.sidebar-shortcut-hint');
      await expect(hint).toHaveCSS('font-size', '10px');
      await expect(hint).toHaveCSS('color', 'rgb(148, 149, 151)');
      for (const container of [sidebar, sidebar.locator('.sidebar-scroll'), sidebar.locator('.workspace-switcher')]) {
        expect(await container.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
      }
      await page.screenshot({ path: testInfo.outputPath(`sidebar-14px-${width}.png`) });
    }
    await page.setViewportSize({ width: 500, height: 720 });
    await expect(sidebar.locator('.workspace-name strong')).toBeHidden();
    await expect(sidebar.locator('.sidebar-shortcut-hint').first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(500);
  } finally {
    await page.close();
    await app.close();
  }
});
