import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

test('Teams directory exposes the retained native control and row-action names', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Teams parity', email: 'teams-parity@example.test', password: 'teams-password' } });
    await page.goto(url + '/teams');
    await expect(page.getByRole('button', { name: 'Create new team', exact: true })).toContainText('New team');
    await expect(page.getByRole('textbox', { name: 'Find teams…', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add filter', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Display options', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Order by Name', exact: true })).toHaveAttribute('aria-sort', 'ascending');
    const first = page.getByRole('link', { name: /Open team member page Open team projects page Open menu/ }).first();
    await expect(first.getByRole('link', { name: 'Open team member page', exact: true })).toBeVisible();
    await expect(first.getByRole('link', { name: 'Open team projects page', exact: true })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Open menu', exact: true })).toHaveCount(1);
  } finally {
    await page.close();
    await app.close();
  }
});
