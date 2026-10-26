import { test, expect, type Locator } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

async function lineCount(locator: Locator) {
  return locator.evaluate((element) => {
    const tops: number[] = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      tops.push(...[...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top)));
    }
    return new Set(tops).size;
  });
}

async function containedIn(locator: Locator, parent: Locator) {
  const box = await locator.boundingBox(), bounds = await parent.boundingBox();
  expect(box).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
}

test('shared navigation and issue headers stay readable in narrow windows', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Layout reviewer', email: 'responsive@example.test', password: 'isolated-layout-test',
      workspaceName: 'A workspace with a deliberately long name',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const team = state.teams[0];
    await page.request.patch(url + '/api/v1/teams/' + team.id, { data: {
      name: 'Engineering and product delivery with a very long team name', version: team.version,
    } });
    const project = await (await page.request.post(url + '/api/v1/projects', { data: {
      name: 'A deliberately long project name for narrow-window layout testing', teamIds: [team.id],
    } })).json();
    const issue = await (await page.request.post(url + '/api/v1/issues', { data: {
      title: 'A deliberately long issue title that must truncate without wrapping its identifier',
      teamId: team.id, projectId: project.id,
    } })).json();

    for (const width of [1280, 960, 864, 800, 610, 500]) {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(url + '/issues/' + issue.id);
      const sidebar = page.locator('.sidebar'), header = page.locator('.issue-detail-view > .page-header');
      const title = header.locator('.issue-header-title');
      await expect(title).toContainText(issue.identifier);
      await expect(title).toHaveCSS('white-space', 'nowrap');
      expect(await lineCount(title.locator('.issue-header-identifier'))).toBe(1);
      await containedIn(title.locator('.issue-header-identifier'), title);
      await containedIn(title, header);
      expect((await page.locator('.issue-article').boundingBox())!.width).toBeGreaterThanOrEqual(260);
      for (const property of await page.locator('.issue-properties-panel .property-button').all()) {
        if (await property.isVisible()) await containedIn(property, page.locator('.issue-properties-panel'));
      }
      if (width > 600) {
        const heading = sidebar.getByRole('button', { name: 'Your teams', exact: true });
        await expect(heading).toHaveCSS('white-space', 'nowrap');
        expect((await heading.boundingBox())!.height).toBeLessThanOrEqual(28);
        await containedIn(heading, sidebar.locator('.sidebar-teams-heading'));
        const teamName = sidebar.locator('.team-heading strong').first();
        expect(await lineCount(teamName)).toBe(1);
        await containedIn(teamName, sidebar.locator('.team-heading').first());
        await containedIn(sidebar.getByRole('button', { name: 'Create new issue', exact: true }), sidebar);
      }
      await page.screenshot({ path: testInfo.outputPath(`issue-${width}.png`) });
      for (const route of ['/my-issues', '/projects', '/project/' + project.id + '/overview', '/team/' + team.id + '/all', '/views', '/search?q=layout', '/inbox', '/customers', '/initiatives', '/settings/profile', '/settings/preferences', '/settings/notifications', '/settings/documents']) {
        await page.goto(url + route);
        await expect(page.locator('.main-panel')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `document overflow on ${route} at ${width}px`).toBe(false);
        const headers = page.locator('.main-panel .page-header, .main-panel .feature-header');
        for (const pageHeader of await headers.all()) {
          if (!await pageHeader.isVisible()) continue;
          const box = await pageHeader.boundingBox();
          expect(box!.height, `header wrapped on ${route} at ${width}px`).toBeLessThanOrEqual(48);
          for (const item of await pageHeader.locator(':scope > button, :scope > a, :scope > h1, :scope > .dropdown, :scope > .feature-heading, :scope > .feature-header-actions').all()) {
            if (await item.isVisible()) await containedIn(item, pageHeader);
          }
          for (const link of await pageHeader.locator(':scope > a').all()) {
            if (await link.isVisible()) expect(await lineCount(link)).toBeLessThanOrEqual(1);
          }
        }
        for (const row of await page.locator('.feature-settings-card .feature-settings-row:not(.members-table-row)').all()) {
          for (const child of await row.locator(':scope > *').all()) {
            if (await child.isVisible()) await containedIn(child, row);
          }
        }
        await page.screenshot({ path: testInfo.outputPath(`${route.replace(/[^a-z]+/gi, '-')}-${width}.png`) });
      }
    }
  } finally {
    await page.close();
    await app.close();
  }
});
