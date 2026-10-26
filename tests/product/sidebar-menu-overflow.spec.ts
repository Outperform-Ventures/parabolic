import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

test('sidebar More menu fits its content without horizontal scrolling', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Menu reviewer', email: 'menu-overflow@example.test', password: 'isolated-menu-test',
    } });
    await page.goto(url + '/my-issues');
    const trigger = page.getByRole('button', { name: 'More workspace views', exact: true });
    const menu = page.locator('.dropdown-content:has(> .sidebar-menu-content)');
    for (const width of [1280, 864, 610]) {
      await page.setViewportSize({ width, height: 720 });
      await trigger.click();
      await expect(menu).toBeVisible();
      const size = await menu.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
      expect(size.scroll, `horizontal overflow at ${width}px`).toBe(size.width);
      expect(size.scrollHeight, `unnecessary vertical scrolling at ${width}px`).toBe(size.height);
      const bounds = (await menu.boundingBox())!;
      for (const item of await menu.getByRole('menuitem').all()) {
        const box = (await item.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      }
      await page.screenshot({ path: testInfo.outputPath(`more-menu-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
    await trigger.click();
    await page.keyboard.type('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    await expect(menu.getByRole('status')).toHaveText('No results');
    expect(await menu.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
    await page.keyboard.press('Escape');
    await trigger.click();
    // Preserve vertical scrolling when a menu genuinely cannot fit the window.
    await page.setViewportSize({ width: 610, height: 95 });
    await expect.poll(() => menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await menu.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Customize sidebar', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
  } finally {
    await page.close();
    await app.close();
  }
});
