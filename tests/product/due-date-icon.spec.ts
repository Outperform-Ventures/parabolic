import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test.use({ timezoneId: 'America/Chicago', deviceScaleFactor: 2 });

test('due-date badges use the reference calendar shape, dimensions and tone colors', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.clock.install({ time: new Date('2026-09-12T17:00:00Z') });
    await page.request.post(url + '/auth/setup', { data: { name: 'Calendar Example', email: 'calendar@example.test', password: 'isolated-calendar-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    for (const [title, dueDate] of [['Later date', '2026-09-30'], ['Soon date', '2026-09-18'], ['Overdue date', '2026-09-10']]) {
      expect((await page.request.post(url + '/api/v1/issues', { data: { teamId: state.teams[0].id, assigneeId: state.user.id, title, dueDate } })).ok()).toBeTruthy();
    }
    await page.goto(url + '/profiles/' + state.user.id);
    const badge = (title: string) => page.locator('.issue-row').filter({ has: page.locator('.issue-row-title', { hasText: title }) }).locator('.issue-due-date');
    for (const title of ['Later date', 'Soon date', 'Overdue date']) {
      const icon = badge(title).locator('svg');
      await expect(icon).toHaveClass('issue-due-date-icon');
      await expect(icon).toHaveCSS('width', '14px');
      await expect(icon).toHaveCSS('height', '14px');
      await expect(icon).toHaveAttribute('viewBox', '0 0 14 14');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon.locator('path')).toHaveCount(1);
      expect(await icon.locator('path').evaluate((path: SVGGraphicsElement) => { const box = path.getBBox(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })).toEqual({ x: 1, y: 1, width: 12, height: 12 });
      await expect(icon.locator('path')).toHaveAttribute('fill-rule', 'evenodd');
      await expect(badge(title)).toHaveCSS('gap', '8px');
      await expect(badge(title)).toHaveCSS('height', '24px');
    }
    await expect(badge('Later date').locator('svg')).toHaveCSS('color', 'rgb(149, 149, 151)');
    await expect(badge('Soon date').locator('svg')).toHaveCSS('color', 'rgb(255, 115, 53)');
    await expect(badge('Soon date').locator('time')).not.toHaveCSS('color', 'rgb(255, 115, 53)');
    await expect(badge('Overdue date')).toHaveAttribute('data-due-tone', 'urgent');
    expect(await badge('Overdue date').locator('svg').evaluate(el => getComputedStyle(el).color)).toBe(await badge('Overdue date').evaluate(el => { const span = document.createElement('span'); span.style.color = 'var(--danger)'; el.append(span); const color = getComputedStyle(span).color; span.remove(); return color; }));
    await badge('Soon date').hover();
    await expect(badge('Soon date').locator('svg')).toHaveCSS('color', 'rgb(255, 115, 53)');
    await expect(page.getByRole('tooltip')).toContainText('Due in 6 days');
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath('calendar-badges.png') });
    await page.getByRole('button', { name: 'Display options', exact: true }).click();
    await page.getByRole('tab', { name: 'Board', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.board-card .issue-due-date-icon')).toHaveCount(3);
    await expect(page.locator('.board-card [data-due-tone="soon"] svg')).toHaveCSS('color', 'rgb(255, 115, 53)');
  } finally { await page.close(); await app.close(); }
});
