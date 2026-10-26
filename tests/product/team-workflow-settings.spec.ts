import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('team settings tabs fit their contents without an inner scrollbar', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Settings owner', email: 'workflow-layout@example.test', password: 'isolated-settings-test',
    } });
    const { teams } = await (await page.request.get(url + '/api/v1/state')).json();
    await page.goto(`${url}/settings/team-${teams[0].id}?section=Workflow`);
    const tabs = page.getByRole('navigation', { name: 'Page views' });
    await expect(tabs).toBeVisible();
    for (const width of [1280, 960, 800]) {
      await page.setViewportSize({ width, height: 850 });
      for (const fontSize of ['16px', '20px']) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
        const metrics = await tabs.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return {
            scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
            contained: [...element.children].every(child => {
              const box = child.getBoundingClientRect();
              return box.top >= bounds.top && box.bottom <= bounds.bottom &&
                box.left >= bounds.left && box.right <= bounds.right;
            }),
          };
        });
        expect(metrics.scrollHeight, `${width}px / ${fontSize}: vertical overflow`).toBe(metrics.clientHeight);
        expect(metrics.scrollWidth, `${width}px / ${fontSize}: horizontal overflow`).toBe(metrics.clientWidth);
        expect(metrics.contained, `${width}px / ${fontSize}: clipped tab`).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath(`workflow-${width}.png`) });
    }
    const scroller = page.locator('.feature-settings-main');
    expect(await scroller.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await tabs.getByRole('button', { name: 'Recurring issues', exact: true }).click();
    await expect(page).toHaveURL(/section=Recurring%20issues$/);
  } finally {
    await page.close();
    await app.close();
  }
});

test('team workflows stay scoped to the route without a redundant team selector', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Settings owner', email: 'workflow-scope@example.test', password: 'isolated-settings-test',
    } });
    const { teams } = await (await page.request.get(url + '/api/v1/state')).json();
    const firstTeam = teams[0];
    const secondTeam = await (await page.request.post(url + '/api/v1/teams', { data: {
      name: 'Second team', key: 'SEC',
    } })).json();
    const firstStatus = await (await page.request.post(url + '/api/v1/statuses', { data: {
      name: 'First team only', teamId: firstTeam.id, type: 'started', color: '#eab308',
    } })).json();
    const secondStatus = await (await page.request.post(url + '/api/v1/statuses', { data: {
      name: 'Second team only', teamId: secondTeam.id, type: 'started', color: '#eab308',
    } })).json();
    const firstRow = page.locator(`[data-workflow-status-id="${firstStatus.id}"]`);
    const secondRow = page.locator(`[data-workflow-status-id="${secondStatus.id}"]`);
    const selector = page.getByRole('combobox', { name: 'Team', exact: true });
    await page.goto(`${url}/settings/team-${firstTeam.id}?section=Workflow`);
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toHaveCount(0);
    await expect(selector).toHaveCount(0);

    // Navigate without remounting the app, as the settings search does.
    const search = page.locator('.feature-settings-nav').getByPlaceholder('Search…');
    await search.fill('Second team');
    await page.locator('.settings-search-results').getByRole('link', { name: /Issue statuses/ }).click();
    await expect(page).toHaveURL(new RegExp(`/settings/team-${secondTeam.id}\\?section=Workflow$`));
    await expect(secondRow).toBeVisible();
    await expect(firstRow).toHaveCount(0);
    await expect(selector).toHaveCount(0);

    await page.getByRole('button', { name: 'New workflow status', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New workflow status', exact: true });
    await dialog.getByLabel('Name', { exact: true }).fill('Created in second team');
    await dialog.getByRole('button', { name: 'Create status', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    expect(state.statuses.find((status: { name: string }) => status.name === 'Created in second team').teamId).toBe(secondTeam.id);

    await page.goto(url + '/settings/workflows');
    await expect(page).toHaveURL(url + '/settings/teams');
    await page.locator('.teams-table-row').getByRole('link', { name: new RegExp(firstTeam.name) }).click();
    await page.getByRole('button', { name: /Issue statuses/ }).click();
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toHaveCount(0);
    await expect(selector).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});
