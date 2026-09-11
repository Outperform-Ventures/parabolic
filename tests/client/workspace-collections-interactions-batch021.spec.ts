import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('workspace All, Active, and Backlog retain click and hover interaction state', async ({ page }: { page: Page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.setViewportSize({ width: 1777, height: 991 });
    await page.request.post(url + '/auth/setup', { data: { name: 'Collection owner', email: 'workspace-collections@example.test', password: 'workspace-collection-password' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const team = state.teams[0];
    const status = (type: string) => state.statuses.find((item: any) => item.teamId === team.id && item.type === type);
    app.repo.create(actor, 'issues', { title: 'Active collection row', teamId: team.id, statusId: status('unstarted').id });
    app.repo.create(actor, 'issues', { title: 'Backlog collection row', teamId: team.id, statusId: status('backlog').id });
    app.repo.create(actor, 'issues', { title: 'Completed collection row', teamId: team.id, statusId: status('completed').id });

    for (const [section, count] of [['all', 3], ['active', 1], ['backlog', 1]] as const) {
      await page.goto(`${url}/issues/${section}`);
      const rows = page.getByTestId('issue-row');
      await expect(rows).toHaveCount(count);
      const first = rows.first();
      await first.hover();
      await expect(first.getByRole('button', { name: /^Select / })).toBeVisible();
      await expect(page.getByRole('toolbar', { name: 'Selected issues' })).toHaveCount(0);

      await first.click({ position: { x: 400, y: 22 } });
      await expect(page).toHaveURL(/\/issues\/[0-9a-f-]+$/);
      await expect(page.locator('.issue-context-link')).toHaveAttribute('href', `/issues/${section}`);
      await page.locator('.issue-context-link').click();
      await expect(page).toHaveURL(`${url}/issues/${section}`);

      const filter = page.getByRole('button', { name: 'Filter issues', exact: true });
      await filter.hover();
      await filter.click();
      await expect(page.locator('.filter-cascade-panel')).toHaveCount(1);
      await expect(page.getByLabel('Add filter', { exact: true })).toBeFocused();
      await page.keyboard.press('Escape');

      const display = page.getByRole('button', { name: 'Display options', exact: true });
      await display.hover();
      await display.click();
      await expect(page.locator('.display-options')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(display).toBeFocused();
    }
  } finally {
    await app.close();
  }
});
