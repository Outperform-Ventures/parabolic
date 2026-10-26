import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';
import { resolveShortcut } from '../../src/client/keyboard';
import { sidebarNavigationShortcuts } from '../../src/client/sidebar-shortcuts';

test('sidebar shortcuts are inline, explicit sequences without duplicate tooltips', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Shortcut reviewer', email: 'sidebar-shortcuts@example.test', password: 'isolated-sidebar-test',
    } });
    await page.goto(url + '/my-issues');
    const sidebar = page.locator('.sidebar');
    const initiatives = sidebar.getByRole('link', { name: 'Initiatives', exact: true });
    const projects = sidebar.getByRole('link', { name: 'Projects', exact: true });
    const hint = initiatives.locator('.sidebar-shortcut-hint');
    await expect(hint).toBeHidden();
    for (const width of [1280, 864, 610]) {
      await page.setViewportSize({ width, height: 800 });
      await initiatives.hover();
      await expect(hint).toBeVisible();
      await expect(hint.locator('kbd')).toHaveText(['G', 'N']);
      await expect(hint.locator('span')).toHaveText('then');
      await expect(initiatives.locator('.sidebar-label')).toHaveCSS('color', 'rgb(255, 255, 255)');
      for (const part of await hint.locator('kbd, span').all()) {
        await expect(part).toHaveCSS('color', 'rgb(148, 149, 151)');
      }
      await expect(initiatives).toHaveAccessibleName('Initiatives');
      await expect(initiatives).toHaveAttribute('aria-description', 'Shortcut: G then N');
      await expect(initiatives).not.toHaveAttribute('title');
      // Wait beyond the actual tooltip delay to catch a late duplicate popup.
      await page.waitForTimeout(700);
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      const row = (await initiatives.boundingBox())!, keys = (await hint.boundingBox())!;
      const label = (await initiatives.locator('.sidebar-label').boundingBox())!;
      expect(keys.x).toBeGreaterThanOrEqual(label.x + label.width - 1);
      expect(keys.x + keys.width).toBeLessThanOrEqual(row.x + row.width);
      expect(keys.y).toBeGreaterThanOrEqual(row.y);
      expect(keys.y + keys.height).toBeLessThanOrEqual(row.y + row.height);
      await page.screenshot({ path: testInfo.outputPath(`inline-shortcut-${width}.png`) });
      await projects.hover();
      await expect(hint).toBeHidden();
      await expect(projects.locator('.sidebar-shortcut-hint kbd')).toHaveText(['G', 'P']);
      await expect(sidebar.getByRole('link', { name: 'Teams', exact: true }).locator('.sidebar-shortcut-hint')).toHaveCount(0);
      await page.mouse.move(width - 1, 799);
      await expect(projects.locator('.sidebar-shortcut-hint')).toBeHidden();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Tab');
    await initiatives.focus();
    await expect(hint).toBeVisible();
    await expect(hint).toHaveCSS('color', 'rgb(148, 149, 151)');
    await page.keyboard.press('g');
    await page.keyboard.press('n');
    await expect(page).toHaveURL(url + '/initiatives');

    // Icon-only controls retain useful names/shortcuts in their tooltips.
    await sidebar.getByRole('button', { name: 'Search workspace', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText('Search workspace');
    await initiatives.hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.waitForTimeout(700);
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    // Every advertised binding agrees with the actual keyboard dispatcher.
    for (const [path, key] of Object.entries(sidebarNavigationShortcuts)) {
      const result = resolveShortcut({ key: key.toLowerCase() }, { scope: 'global' }, { key: 'g', at: 100 }, 200);
      if (path === '/drafts') expect(result.action?.command).toBe('open-drafts');
      else expect(result.action).toMatchObject({ command: 'navigate', route: path });
    }
    await page.setViewportSize({ width: 500, height: 800 });
    await initiatives.hover();
    await expect(hint).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(500);
  } finally {
    await page.close();
    await app.close();
  }
});
