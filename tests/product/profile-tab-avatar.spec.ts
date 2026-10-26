import { test, expect, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function expectTabIconSize(icon: Locator) {
  await expect(icon).toBeVisible();
  const box = (await icon.boundingBox())!;
  expect(box.width).toBeCloseTo(14, 1);
  expect(box.height).toBeCloseTo(14, 1);
}

test('member tab avatars stay circular while only the title flexes', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Member with a deliberately long name', email: 'tab-avatar@example.test', password: 'isolated-avatar-test',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    await page.addInitScript(() => {
      (window as any).desktop = {
        isDesktop: true, platform: 'darwin', getNavigationTabs: async () => true,
        getHardwareAcceleration: async () => ({ enabled: true, canDisable: true }),
        onCommand: () => () => {}, setBadge: async () => {}, setTheme: async () => {},
        notify: async () => true, copyText: async () => {},
      };
    });
    await page.goto(url + '/members');
    await page.getByRole('link', { name: /Member with a deliberately long name/ }).click();
    await expect(page).toHaveURL(url + '/profiles/' + state.user.id);
    const tab = page.locator('.app-tab.active');
    for (const width of [1280, 864, 610, 500]) {
      await page.setViewportSize({ width, height: 720 });
      await expectTabIconSize(tab.locator('> .avatar'));
      const label = tab.locator('> .app-tab-label');
      await expect(label).toHaveCSS('text-overflow', 'ellipsis');
      const box = (await tab.boundingBox())!, avatar = (await tab.locator('> .avatar').boundingBox())!;
      const title = (await label.boundingBox())!;
      expect(title.x).toBeGreaterThanOrEqual(avatar.x + avatar.width);
      expect(title.x + title.width).toBeLessThanOrEqual(box.x + box.width);
      for (const button of await tab.getByRole('button').all()) {
        const bounds = (await button.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(title.x + title.width);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width);
      }
      await page.screenshot({ path: testInfo.outputPath(`profile-avatar-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    // Photo avatars must keep the same bounds as initials.
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    app.repo.update(actor, 'users', state.user.id, {
      avatar: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="purple"/></svg>'),
    });
    await page.reload();
    await expectTabIconSize(tab.locator('> .avatar'));
    await expectTabIconSize(tab.locator('> .avatar img'));
    await page.getByRole('link', { name: 'Created', exact: true }).click();
    await expectTabIconSize(tab.locator('> .avatar'));
    await page.getByRole('button', { name: 'New tab', exact: true }).click();
    await expect(page.locator('.app-tab')).toHaveCount(2);
    const profileTab = page.locator('.app-tab').filter({ has: page.locator('> .avatar') });
    await expectTabIconSize(profileTab.locator('> .avatar'));
    await profileTab.hover();
    await expectTabIconSize(profileTab.locator('> .avatar'));
    await profileTab.click();
    await profileTab.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Pin tab/ }).click();
    await expectTabIconSize(page.locator('.app-tab.pinned > .avatar'));
    // Issue status icons were affected by the same overly broad span rule.
    const issue = await (await page.request.post(url + '/api/v1/issues', { data: {
      teamId: state.teams[0].id, title: 'Tab status icon regression',
    } })).json();
    await page.goto(url + '/issues/' + issue.id);
    await expectTabIconSize(page.locator('.app-tab.active > .status-icon'));
  } finally {
    await page.close();
    await app.close();
  }
});
