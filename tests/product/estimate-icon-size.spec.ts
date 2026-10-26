import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('effort icons stay 16px in rows, group totals, selection, menus, boards and details', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Effort Example', email: 'effort-icons@example.test', password: 'isolated-effort-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const response = await page.request.post(url + '/api/v1/issues', { data: { teamId: state.teams[0].id, assigneeId: state.user.id, title: 'Effort icon example', estimate: 3 } });
    expect(response.ok()).toBeTruthy();
    const after = await (await page.request.get(url + '/api/v1/state')).json();
    const issue = after.issues.find((item: any) => item.title === 'Effort icon example');
    const icons = page.locator('[data-entity-icon="Estimate"]');
    const check = async () => {
      expect(await icons.count()).toBeGreaterThan(0);
      for (const icon of await icons.all()) {
        if (!await icon.isVisible()) continue;
        await expect(icon).toHaveCSS('width', '16px');
        await expect(icon).toHaveCSS('height', '16px');
        await expect(icon).toHaveCSS('flex-shrink', '0');
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
      }
    };
    await page.goto(url + '/profiles/' + state.user.id);
    await expect(page.locator('.issue-estimate svg')).toBeVisible();
    for (const width of [1280, 960, 610]) {
      await page.setViewportSize({ width, height: 800 });
      await check();
      await expect(page.locator('.group-count')).toHaveCSS('font-size', '14px');
      await expect(page.locator('.issue-estimate')).toHaveCSS('font-size', '13px');
      await expect(page.locator('.issue-estimate')).toHaveCSS('gap', '3px');
      await expect(page.locator('.issue-estimate > span')).toHaveCSS('text-align', 'left');
      const textGap = await page.locator('.issue-estimate').evaluate(element => {
        const icon = element.querySelector('svg')!.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element.querySelector('span')!);
        return range.getBoundingClientRect().left - icon.right;
      });
      expect(textGap).toBeCloseTo(3, 1);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.issue-row').getByRole('button', { name: 'Change estimate', exact: true }).click();
    await expect.poll(() => icons.count()).toBeGreaterThan(2);
    await check();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Select ' + issue.identifier, exact: true }).click();
    await expect(page.locator('.selection-estimate svg')).toBeVisible();
    await check();
    await page.getByRole('button', { name: 'Clear selected', exact: true }).click();
    await page.getByRole('button', { name: 'Add filter', exact: true }).click();
    const filterIcon = page.locator('[data-native-filter-icon="Estimate"]');
    await expect(filterIcon).toHaveCSS('width', '16px');
    await expect(filterIcon).toHaveCSS('height', '16px');
    await page.getByRole('menuitem', { name: 'Estimate', exact: true }).click();
    await check();
    await page.getByRole('menuitem', { name: '3', exact: true }).click();
    await page.keyboard.press('Escape');
    const chipIcon = page.locator('.issue-filter-chip [data-native-filter-icon="Estimate"]');
    await expect(chipIcon).toHaveCSS('width', '16px');
    await expect(chipIcon).toHaveCSS('height', '16px');
    await expect(chipIcon.locator('..')).toHaveCSS('width', '16px');
    await page.getByRole('button', { name: 'Remove Estimate filter', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath('effort-icons-16px.png') });
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('tab', { name: 'Board', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.board-card-estimate svg')).toBeVisible();
    await check();
    await page.goto(url + '/issues/' + issue.id);
    await expect(page.locator('.issue-properties-panel [data-entity-icon="Estimate"]')).toBeVisible();
    await check();
    const final = await (await page.request.get(url + '/api/v1/state')).json();
    expect(final.issues.find((item: any) => item.id === issue.id).estimate).toBe(3);
  } finally { await page.close(); await app.close(); }
});
