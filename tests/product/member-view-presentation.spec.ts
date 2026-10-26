import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';
import type { Entity } from '../../src/shared/types';
import { legacyProfileProperties } from '../../src/client/profile-display';

test('member view rebases legacy defaults to active-first groups, newest rows and clean metadata', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Member Example', email: 'member-layout@example.test', password: 'isolated-member-layout' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const team = state.teams[0];
    const project = app.repo.create(actor, 'projects', { name: 'Sample project', icon: 'Shop', color: '#5e6ad2', teamIds: [team.id] });
    const seeded: Entity[] = [];
    for (const [type, title, estimate, day] of [
      ['backlog', 'Backlog item', 8, 12], ['unstarted', 'Todo item', 3, 10],
      ['started', 'Older active work', 2, 8], ['started', 'Newest active work with a descriptive title', 4, 11],
    ] as const) {
      const status = state.statuses.find((s: any) => s.teamId === team.id && s.type === type);
      const issue = app.repo.create(actor, 'issues', { teamId: team.id, statusId: status.id, title, assigneeId: state.user.id, projectId: project.id, estimate, priority: 2, dueDate: '2026-09-30' });
      const dated = { ...issue, createdAt: `2026-09-${String(day).padStart(2, '0')}T12:00:00Z` };
      app.repo.save('issues', dated, 'update', actor); seeded.push(dated);
    }
    const key = `display:${state.workspaceId}:${state.user.id}:profile:${state.user.id}:Assigned`;
    await page.addInitScript(({ key, properties }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ groupBy: 'statusId', subGroupBy: 'none', groupCount: 'issues', orderBy: 'priority', direction: 'asc', properties, showEmpty: false, showSubIssues: true, nestedSubIssues: true }));
    }, { key, properties: legacyProfileProperties });
    await page.goto(url + '/profiles/' + state.user.id);
    const view = page.locator('.profile-issues');
    await expect(view.locator('.profile-user-trigger')).toContainText('Member Example');
    await expect(view.locator('.profile-user-trigger > svg')).toBeVisible();
    const groups = view.locator('.group-header[data-group-field="statusId"]');
    await expect(groups.locator(':scope > strong')).toHaveText(['In Progress', 'Todo', 'Backlog']);
    await expect(groups.locator('.group-count')).toHaveText(['6', '3', '8']);
    await expect(groups.first().locator('.group-count [data-entity-icon="Estimate"]')).toBeVisible();
    const rows = view.locator('.issue-row');
    await expect(rows.locator('.issue-row-title')).toHaveText([seeded[3].title, seeded[2].title, seeded[1].title, seeded[0].title]);
    for (const width of [1440, 1280, 960, 610]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(rows.first().locator('.issue-project-badge [data-entity-icon="Shop"]')).toBeVisible();
      await expect(rows.first().locator('.issue-due-date')).toHaveCSS('border-radius', '9999px');
      if (width <= 800) await expect(rows.first().locator('.issue-due-date')).toBeHidden();
      else await expect(rows.first().locator('.issue-due-date')).toBeVisible();
      await expect(view).not.toContainText('in status');
      await expect(rows.first().locator(':scope > time')).toHaveCount(1);
      const row = (await rows.first().boundingBox())!, title = (await rows.first().locator('.issue-row-title').boundingBox())!;
      expect(title.width).toBeGreaterThanOrEqual(width >= 1280 ? 300 : width >= 960 ? 160 : 80);
      for (const item of await rows.first().locator('.issue-project-badge, .issue-estimate-control, .avatar, .issue-due-date').all()) {
        if (!await item.isVisible()) continue;
        const box = (await item.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(title.x + title.width);
        expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width);
      }
      await page.screenshot({ path: testInfo.outputPath(`member-layout-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await expect(groups.locator('.group-count')).toHaveText(['6', '3', '8']);
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await expect(page.getByLabel('Ordering', { exact: true })).toHaveValue('createdAt');
    await page.getByRole('button', { name: 'Display timeInStatus', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(rows.first()).toContainText('in status');
    await page.reload();
    await expect(rows.first()).toContainText('in status');
    await page.getByRole('link', { name: 'Created', exact: true }).click();
    await expect(groups).toHaveCount(0);
    const after = await (await page.request.get(url + '/api/v1/state')).json();
    for (const issue of seeded) {
      const current = after.issues.find((item: any) => item.id === issue.id);
      for (const field of ['title', 'statusId', 'assigneeId', 'projectId', 'estimate', 'priority', 'createdAt']) expect(current[field]).toEqual(issue[field]);
    }
  } finally { await page.close(); await app.close(); }
});
