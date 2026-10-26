import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

// Headless Chromium otherwise hides scrollbars and misses macOS gutter reflow.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function fixture(page: Page, wideDoneIdentifier = false) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: { name: 'Collapse Example', email: 'collapse@example.test', password: 'isolated-collapse-test' } });
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const team = state.teams[0];
  const project = app.repo.create(actor, 'projects', { name: 'Stable project', teamIds: [team.id] });
  const activeIds: string[] = [];
  let number = 0;
  for (const [type, count] of [['started', 2], ['unstarted', 2], ['completed', 45]] as const) {
    const status = state.statuses.find((s: any) => s.teamId === team.id && s.type === type);
    for (let index = 0; index < count; index++) {
      const issue = app.repo.create(actor, 'issues', { title: `${type} example ${index}`, teamId: team.id, statusId: status.id, projectId: project.id, assigneeId: state.user.id, estimate: 2, priority: 2 });
      app.repo.save('issues', { ...issue, identifier: wideDoneIdentifier && type === 'completed' ? `LONGTEAM-${++number}` : `ENG-${String(++number).padStart(3, '0')}` }, 'update', actor);
      if (type !== 'completed') activeIds.push(issue.id);
    }
  }
  return { app, url, actor, activeIds, routes: ['/profiles/' + state.user.id, '/team/' + team.id + '/all', '/project/' + project.id + '/issues'] };
}

const doneToggle = (page: Page) => page.locator('.group-header').filter({ has: page.getByText('Done', { exact: true }) }).locator('.group-toggle');

test('collapsing Done does not resize the shared issue identifier column', async ({ page }) => {
  const f = await fixture(page, true);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(f.url + f.routes[0]);
    await page.evaluate(() => document.fonts.ready);
    const row = page.locator(`[data-issue-id="${f.activeIds[0]}"]`);
    const identifier = row.locator('.issue-identifier');
    const width = (await identifier.boundingBox())!.width;
    expect(width).toBeGreaterThan(75);
    const statusX = (await row.locator('[data-property="statusId"]').boundingBox())!.x;
    await doneToggle(page).click();
    await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await identifier.boundingBox())!.width).toBe(width);
    expect((await row.locator('[data-property="statusId"]').boundingBox())!.x).toBe(statusX);
    await doneToggle(page).click();
    await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'true');
    expect((await identifier.boundingBox())!.width).toBe(width);
  } finally { await page.close(); await f.app.close(); }
});

test('collapse and expand keep other row geometry stable when the scrollbar disappears', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    for (const [routeIndex, route] of f.routes.entries()) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(f.url + route);
      // Test the issue list itself, without the team summary's narrow-screen overlay.
      const closeDetails = page.getByRole('button', { name: 'Close details', exact: true });
      if (await closeDetails.count()) await closeDetails.click();
      // Model macOS's space-consuming, always-visible scrollbar preference.
      await page.addStyleTag({ content: '.issue-list-scroll::-webkit-scrollbar { width: 16px; height: 16px; }' });
      await page.evaluate(() => document.fonts.ready);
      const scroll = page.locator('.issue-list-scroll');
      await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'true');
      for (const width of [1280, 960, 610]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        expect(await scroll.evaluate(el => (el as HTMLElement).offsetWidth - el.clientWidth)).toBe(16);
        const snapshot = () => page.evaluate(ids => {
          const scroll = document.querySelector('.issue-list-scroll')!;
          const origin = scroll.getBoundingClientRect();
          const rect = (el: Element) => { const b = el.getBoundingClientRect(); return [b.x - origin.x, b.y - origin.y, b.width, b.height].map(n => Math.round(n * 100) / 100); };
          return { width: scroll.clientWidth, rows: ids.map(id => {
            const row = document.querySelector(`[data-issue-id="${id}"]`)!;
            return [rect(row), ...Array.from(row.querySelectorAll('.issue-identifier, [data-property="priority"], [data-property="statusId"], .issue-row-title, .issue-project-badge, .issue-estimate-control, .inline-assignee-button, .issue-row-date')).map(rect)];
          }) };
        }, f.activeIds);
        const expanded = await snapshot();
        await doneToggle(page).click();
        await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(() => scroll.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
        await expect.poll(snapshot, { message: `Other rows shifted after collapsing Done: ${route} at ${width}px` }).toEqual(expanded);
        if (routeIndex === 0 && width === 1280) await page.screenshot({ path: info.outputPath('done-collapsed-stable.png') });
        await doneToggle(page).click();
        await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'true');
        await expect.poll(snapshot).toEqual(expanded);
        if (routeIndex === 0 && width === 1280) await page.screenshot({ path: info.outputPath('done-expanded-stable.png') });
      }
    }
    const after = await (await page.request.get(f.url + '/api/v1/state')).json();
    expect(after.issues).toHaveLength(49);
    expect(after.issues.filter((issue: any) => f.activeIds.includes(issue.id)).every((issue: any) => issue.estimate === 2)).toBe(true);
  } finally { await page.close(); await f.app.close(); }
});
