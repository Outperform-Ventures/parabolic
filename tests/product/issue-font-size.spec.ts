import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('issue titles, identifiers, group headings/counts and navigation tabs use 14px', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Issue Font Example', email: 'issue-font@example.test', password: 'isolated-issue-font' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const team = state.teams[0];
    app.repo.update(actor, 'teams', team.id, { version: team.version, key: 'LONGTEAM' });
    const project = app.repo.create(actor, 'projects', { name: 'Typography project', teamIds: [team.id] });
    for (const title of ['A long issue title that should truncate cleanly instead of crowding adjacent controls', 'Short issue']) {
      app.repo.create(actor, 'issues', { title, teamId: team.id, projectId: project.id, assigneeId: state.user.id, estimate: 3, dueDate: '2026-09-30' });
    }
    for (const route of ['/profiles/' + state.user.id, '/team/' + team.id + '/all', '/project/' + project.id + '/issues']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url + route);
      const view = page.locator('.issue-view').first();
      await expect(view.locator('.issue-row').first()).toBeVisible();
      for (const selector of ['.issue-row-title', '.issue-identifier', '.group-header > strong', '.group-count', '.page-tabs > a']) {
        const labels = view.locator(selector);
        for (const label of await labels.all()) await expect(label).toHaveCSS('font-size', '14px');
      }
      for (const label of await view.locator('.issue-project-badge, .issue-estimate, .issue-row-date, .issue-due-date').all()) {
        await expect(label).toHaveCSS('font-size', '13px');
      }
      for (const width of [1280, 960, 610]) {
        await page.setViewportSize({ width, height: 800 });
        const row = view.locator('.issue-row').first();
        await expect(row.locator('.issue-row-title')).toHaveCSS('font-size', '14px');
        await expect(row.locator('.issue-row-title')).toHaveCSS('white-space', 'nowrap');
        const status = row.locator(':scope > [data-property="statusId"]');
        if (await status.count()) {
          const statusBox = (await status.boundingBox())!, titleBox = (await row.locator('.issue-row-title').boundingBox())!;
          const gap = await row.evaluate(el => Number.parseFloat(getComputedStyle(el).columnGap));
          expect(titleBox.x - statusBox.x - statusBox.width, 'status-to-title spacing follows the full row gap').toBeCloseTo(gap, 1);
        }
        if (await row.locator('.issue-identifier').count()) {
          const id = row.locator('.issue-identifier');
          await expect(id).toHaveText(/^LONGTEAM-/);
          expect(await id.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
          const idBox = (await id.boundingBox())!, titleBox = (await row.locator('.issue-row-title').boundingBox())!;
          expect(titleBox.x).toBeGreaterThanOrEqual(idBox.x + idBox.width);
        }
        const rowBox = (await row.boundingBox())!, titleBox = (await row.locator('.issue-row-title').boundingBox())!;
        for (const metadata of await row.locator('.issue-project-badge, .issue-estimate-control, .issue-row-date, .issue-due-date, .avatar').all()) {
          if (!await metadata.isVisible()) continue;
          const box = (await metadata.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
          expect(box.x + box.width, `${route} at ${width}px: ${await metadata.getAttribute('class')}`).toBeLessThanOrEqual(rowBox.x + rowBox.width);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      if (route.startsWith('/profiles/')) {
        await expect(view.locator('.group-count').first()).toHaveCSS('font-size', '14px');
        await expect(view.getByRole('link', { name: 'Assigned', exact: true })).toHaveCSS('font-size', '14px');
        await expect(view.getByRole('link', { name: 'Created', exact: true })).toHaveCSS('font-size', '14px');
        await expect(view.locator('.issue-due-date-icon').first()).toHaveCSS('width', '14px');
        await expect(view.locator('.issue-due-date').first()).toHaveCSS('font-size', '13px');
        await expect(view.locator('.issue-project-badge').first()).toHaveCSS('height', '24px');
        await expect(view.locator('.issue-project-badge > svg').first()).toHaveCSS('width', '14px');
        await expect(view.locator('.issue-estimate > svg').first()).toHaveCSS('width', '16px');
        await expect(view.locator('.issue-row .inline-assignee-button > .avatar').first()).toHaveCSS('width', '18px');
        await page.screenshot({ path: testInfo.outputPath('issue-text-14px.png') });
      }
      await view.getByRole('button', { name: 'Display options', exact: true }).click();
      await page.getByRole('tab', { name: 'Board', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(view.locator('.board-card-title').first()).toHaveCSS('font-size', '14px');
      for (const label of await view.locator('.board-card-identifier, .group-header > strong, .group-count').all()) {
        await expect(label).toHaveCSS('font-size', '14px');
      }
      for (const label of await view.locator('.board-project-badge, .board-card-estimate, .board-card > time, .issue-due-date').all()) {
        await expect(label).toHaveCSS('font-size', '13px');
      }
    }
  } finally { await page.close(); await app.close(); }
});
