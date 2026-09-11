import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('Members display options match native choices and persist view preferences', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Directory owner', email: 'owner@example.test', password: 'owner-password' } });
    await page.goto(url + '/members');
    const ownerRow = page.getByRole('row').filter({ hasText: 'Directory owner' });
    await expect(page.getByRole('button', { name: 'Directory owner actions', exact: true })).toHaveCount(0);
    await ownerRow.click();
    await expect(page).toHaveURL(/\/profiles\//);
    await page.goBack();
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    const ordering = page.getByRole('combobox', { name: 'Member ordering' });
    await expect(ordering.locator('option')).toHaveText(['Name', 'Status', 'Joined']);
    await ordering.selectOption('status');
    await page.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByRole('button', { name: 'Teams', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Teams', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Teams', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Member ordering' })).toHaveValue('status');
    await expect(page.getByRole('button', { name: 'Direction', exact: true })).toHaveAttribute('title', 'Descending');
    await expect(page.getByRole('button', { name: 'Teams', exact: true })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await app.close();
  }
});
