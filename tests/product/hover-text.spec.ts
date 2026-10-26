import { test, expect, type Locator } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';
import { generateCustomTheme } from '../../src/client/theme-colors';

const white = 'rgb(255, 255, 255)';
async function textLeft(locator: Locator) {
  return locator.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    }
    throw new Error('Missing heading text');
  });
}
async function hoverWhite(locator: Locator) {
  await locator.hover();
  await expect.soft(locator).toHaveCSS('color', white);
}

test('sidebar headings align and hover text is pure white without changing resting colors', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Hover reviewer', email: 'hover@example.test', password: 'isolated-hover-test',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json(), team = state.teams[0];
    await page.request.post(url + '/api/v1/favorites', { data: {
      type: 'team', entityKind: 'teams', entityId: team.id, section: 'active',
      label: 'Active issues ' + team.name, route: '/team/' + team.id + '/active',
    } });
    const issue = await (await page.request.post(url + '/api/v1/issues', { data: {
      title: 'Hover regression issue', teamId: team.id,
    } })).json();

    for (const width of [1280, 864, 610]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url + '/my-issues');
      const sidebar = page.locator('.sidebar');
      const headings = ['Workspace', 'Favorites', 'Your teams'].map(name => sidebar.getByRole('button', { name, exact: true }));
      await expect(headings[0]).toBeVisible();
      const left = await textLeft(headings[0]);
      for (const heading of headings) {
        expect(await textLeft(heading)).toBeCloseTo(left, 1);
        await page.mouse.move(width - 1, 799);
        const resting = await heading.evaluate(el => getComputedStyle(el).color);
        expect(resting).not.toBe(white);
        await hoverWhite(heading);
        await page.mouse.move(width - 1, 799);
        await expect(heading).toHaveCSS('color', resting);
      }
      await hoverWhite(sidebar.getByRole('link', { name: 'My issues', exact: true }));
      await hoverWhite(sidebar.getByRole('link', { name: 'Projects', exact: true }));
      await hoverWhite(sidebar.locator('.organized-favorite > .sidebar-link').first());
      await hoverWhite(sidebar.locator('.team-heading > button:first-child').first());
      await hoverWhite(headings[1]);
      await page.screenshot({ path: testInfo.outputPath(`sidebar-hover-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [route, selectors] of [
      ['/issues/' + issue.id, ['.issue-properties-panel .property-button', '.issue-article .text-button', '.page-header .icon-button']],
      ['/my-issues', ['.page-tabs > button:not(:disabled)']],
      ['/projects', ['.project-workspace > .feature-header .feature-button', '.project-workspace .project-control']],
      ['/settings/profile', ['.feature-settings-nav section > a', '.profile-email-control > .feature-button']],
    ] as const) {
      await page.goto(url + route);
      for (const selector of selectors) await hoverWhite(page.locator(selector).first());
    }

    await page.goto(url + '/my-issues');
    for (const theme of ['magic-blue', 'classic-dark', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await hoverWhite(page.getByRole('button', { name: 'Workspace', exact: true }));
    }
    for (const theme of ['light', 'pure-light']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const heading = page.getByRole('button', { name: 'Workspace', exact: true });
      await heading.hover();
      await expect(heading).not.toHaveCSS('color', white);
    }
    const custom = generateCustomTheme({ base: [12, 4, 280], accent: [50, 60, 288], contrast: 30,
      sidebarInput: { base: [95, 2, 280], accent: [50, 60, 288], contrast: 30 } });
    expect(custom['--hover-text']).toBe('#ffffff');
    expect(custom['--sidebar-hover-text']).not.toBe('#ffffff');
  } finally {
    await page.close();
    await app.close();
  }
});
