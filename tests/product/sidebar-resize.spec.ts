import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function beginResize(page: Page) {
  const box = await page.getByRole('separator', { name: 'Resize sidebar' }).boundingBox();
  expect(box).not.toBeNull();
  const point = { x: box!.x + box!.width / 2, y: box!.y + 100 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

async function resizeTo(page: Page, width: number) {
  const point = await beginResize(page);
  const actual = await page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().width);
  await page.mouse.move(point.x + width - actual, point.y, { steps: 8 });
  await page.mouse.up();
}

async function expectWidth(page: Page, expected: number) {
  await expect.poll(() => page.locator('.sidebar').evaluate(el => Math.round(el.getBoundingClientRect().width))).toBe(expected);
}

test('sidebar hover and dragging change only the cursor, not the divider color', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Pointer reviewer', email: 'sidebar-pointer@example.test', password: 'isolated-layout-test' } });
    await page.goto(url + '/my-issues');
    const handle = page.getByRole('separator', { name: 'Resize sidebar' });
    await expectWidth(page, 244);
    const paint = () => handle.evaluate(el => {
      const style = getComputedStyle(el), after = getComputedStyle(el, '::after');
      return { background: style.backgroundColor, border: style.border, outline: style.outline, shadow: style.boxShadow, after: { content: after.content, background: after.backgroundColor } };
    });
    const idle = await paint();
    await handle.hover();
    expect(await paint()).toEqual(idle);
    await expect(handle).toHaveCSS('cursor', 'col-resize');
    const point = await beginResize(page);
    await page.mouse.move(point.x + 80, point.y, { steps: 8 });
    await expectWidth(page, 324);
    expect(await paint()).toEqual(idle);
    await expect(page.locator('body')).toHaveCSS('cursor', 'col-resize');
    await page.screenshot({ path: testInfo.outputPath('sidebar-drag-no-highlight.png') });
    await page.mouse.up();
    expect(await paint()).toEqual(idle);
    await page.mouse.move(600, 100);
    expect(await paint()).toEqual(idle);
    await resizeTo(page, 80);
    await expect(page.locator('.sidebar')).toBeHidden();
    await handle.hover();
    expect(await paint()).toEqual(idle);
    await expect(handle).toHaveCSS('cursor', 'col-resize');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expectWidth(page, 324);
    await expect(handle).toHaveCSS('outline-style', 'solid');
  } finally { await page.close(); await app.close(); }
});

test('sidebar edge resizes, collapses, restores, and persists without affecting settings', async ({ page }, testInfo) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Resize reviewer', email: 'sidebar-resize@example.test', password: 'isolated-layout-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const key = `sidebar-layout:${state.user.id}:${state.workspaceId}`;
    await page.goto(url + '/my-issues');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expectWidth(page, 244);
    await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCSS('cursor', 'col-resize');

    await resizeTo(page, 340);
    await expectWidth(page, 340);
    expect(await page.locator('.main-panel').evaluate(el => el.getBoundingClientRect().left)).toBe(340);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual({ width: 340, collapsed: false });
    await page.reload();
    await expectWidth(page, 340);
    await page.screenshot({ path: testInfo.outputPath('sidebar-expanded.png') });

    const point = await beginResize(page);
    await page.mouse.move(point.x + 70, point.y);
    await expectWidth(page, 410);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expectWidth(page, 340);
    await expect(page.locator('body')).not.toHaveClass(/sidebar-is-resizing/);

    await resizeTo(page, 80);
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveAttribute('aria-valuenow', '0');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual({ width: 340, collapsed: true });
    await page.reload();
    await expect(page.locator('.sidebar')).toBeHidden();
    await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
    await expectWidth(page, 340);
    // The native toolbar is hidden in a single-tab web window; its existing
    // keyboard command exercises the same show/hide path.
    await page.keyboard.press('[');
    await expect(page.locator('.sidebar')).toBeHidden();
    await resizeTo(page, 280);
    await expectWidth(page, 280);

    const handle = page.getByRole('separator', { name: 'Resize sidebar' });
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expectWidth(page, 296);
    await page.keyboard.press('Home');
    await expect(page.locator('.sidebar')).toBeHidden();
    await page.keyboard.press('Enter');
    await expectWidth(page, 296);
    await page.keyboard.press('End');
    await expectWidth(page, 480);
    await page.setViewportSize({ width: 800, height: 720 });
    await expectWidth(page, 440);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expectWidth(page, 480);
    await handle.dblclick();
    await expectWidth(page, 244);
    await resizeTo(page, 310);

    await page.goto(url + '/settings/slas');
    await expect(page.getByRole('heading', { name: 'SLAs', exact: true })).toBeVisible();
    await expect(handle).toHaveCount(0);
    await expect(page.locator('.feature-settings-nav')).toBeVisible();
    await page.goto(url + '/my-issues');
    await expectWidth(page, 310);
    for (const width of [800, 610, 500]) {
      await page.setViewportSize({ width, height: 720 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.sidebar .workspace-name strong')).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath('sidebar-narrow.png') });
    await page.setViewportSize({ width: 1280, height: 720 });
    const other = await (await page.request.post(url + '/auth/workspaces', { data: { name: 'Another workspace' } })).json();
    await page.reload();
    await expectWidth(page, 244);
    await resizeTo(page, 380);
    await page.request.post(url + '/auth/workspace', { data: { workspaceId: state.workspaceId } });
    await page.reload();
    await expectWidth(page, 310);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `sidebar-layout:${state.user.id}:${other.workspaceId}`)).toEqual({ width: 380, collapsed: false });
  } finally { await page.close(); await app.close(); }
});

test('pointer cancellation and malformed preferences do not leave stuck resize state', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: { name: 'Cancel reviewer', email: 'sidebar-cancel@example.test', password: 'isolated-layout-test' } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const key = `sidebar-layout:${state.user.id}:${state.workspaceId}`;
    await page.goto(url + '/my-issues');
    await page.evaluate(key => localStorage.setItem(key, '{invalid'), key);
    await page.reload();
    await expectWidth(page, 244);
    const point = await beginResize(page);
    await page.mouse.move(point.x + 60, point.y);
    await expectWidth(page, 304);
    await page.getByRole('separator', { name: 'Resize sidebar' }).dispatchEvent('pointercancel', { pointerId: 1 });
    await page.mouse.up();
    await expectWidth(page, 244);
    await expect(page.locator('body')).not.toHaveClass(/sidebar-is-resizing/);
    const blurPoint = await beginResize(page);
    await page.mouse.move(blurPoint.x + 80, blurPoint.y);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    await expectWidth(page, 244);
    const leavePoint = await beginResize(page);
    await page.mouse.move(leavePoint.x + 80, leavePoint.y);
    await page.evaluate(() => {
      history.pushState(null, '', '/settings/slas');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByRole('heading', { name: 'SLAs', exact: true })).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-is-resizing/);
    expect(await page.locator('.workspace-shell').evaluate(el => (el as HTMLElement).style.getPropertyValue('--sidebar-preview-width'))).toBe('');
    await page.goto(url + '/my-issues');
    await expectWidth(page, 244);
    await page.evaluate(() => Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('Storage unavailable'); }, configurable: true }));
    await resizeTo(page, 320);
    await expectWidth(page, 320);
  } finally { await page.close(); await app.close(); }
});
