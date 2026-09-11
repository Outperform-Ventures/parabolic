import { test, expect, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test('font and cursor preferences affect actual settings, navigation, menus and editors while preserving chrome', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const staticDir = resolve(process.env.PARABOLIC_FONT_RENDERER_DIR || 'dist');
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const measurements: Record<string, Record<string, number>> = {};
  const cursors: Record<string, string>[] = [];
  // Native public Settings catalog: Smaller/Small/Default/Large/Larger.
  const roots = { Smaller: 14, Small: 15, Default: 16, Large: 18, Larger: 20 } as const;
  const font = (locator: Locator) => locator.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  const dimension = (locator: Locator, axis: 'width'|'height') => locator.evaluate((element, axis) => element.getBoundingClientRect()[axis], axis);
  try {
    expect((await page.request.post(url + '/auth/setup', { data: { name: 'Font preference owner', email: 'font-preference@example.test', password: 'Font-preference-password', workspaceName: 'Text sizes' } })).ok()).toBe(true);
    const initial = await (await page.request.get(url + '/api/v1/state')).json();
    const issue = await (await page.request.post(url + '/api/v1/issues', { data: { title: 'A readable issue title', description: '<p>Readable editor content</p>', teamId: initial.teams[0].id } })).json();
    const project = await (await page.request.post(url + '/api/v1/projects', { data: { name: 'Cursor project', teamIds: [initial.teams[0].id] } })).json();
    expect((await page.request.post(url + '/api/v1/milestones', { data: { name: 'Draggable milestone', projectId: project.id } })).ok()).toBe(true);
    await page.goto(url + '/issues/' + issue.id);
    await expect(page.getByLabel('Issue title', { exact: true })).toHaveValue(issue.title);
    await page.keyboard.press(await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta+t' : 'Control+t'));
    await expect(page.locator('.app-tab')).toHaveCount(2);

    for (const size of ['Default', 'Smaller', 'Small', 'Large', 'Larger', 'Restored'] as const) {
      const preference = size === 'Restored' ? 'Default' : size;
      await page.goto(url + '/settings');
      const select = page.getByLabel('Font size', { exact: true });
      await expect(select).toBeVisible();
      await expect(select.locator('option')).toHaveText(['Smaller', 'Small', 'Default', 'Large', 'Larger']);
      await select.selectOption(preference);
      await expect(select).toHaveValue(preference);
      await expect.poll(() => page.evaluate(() => localStorage.getItem('parabolic:font-size'))).toBe(preference);
      expect((await (await page.request.get(url + '/api/v1/state')).json()).user.preferences.fontSize).toBeUndefined();
      await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize)).toBe(roots[preference] + 'px');
      const row = page.locator('.feature-settings-row').filter({ has: select });
      const settings = await font(row.locator('strong'));
      const settingsDescription = await font(row.locator('p'));
      const settingsControl = await font(select);
      if (size === 'Larger') {
        await row.scrollIntoViewIfNeeded();
        await testInfo.attach('larger-settings', { body: await page.screenshot(), contentType: 'image/png' });
      }
      await page.goto(url + '/issues/' + issue.id);
      await expect(page.getByLabel('Issue title', { exact: true })).toHaveValue(issue.title);
      const editor = page.locator('.issue-article>.rich-editor .tiptap');
      await expect(editor).toHaveText('Readable editor content');
      const teamToggle = page.locator('.team-heading>button:first-child').first();
      if (await teamToggle.getAttribute('aria-expanded') === 'false') await teamToggle.click();
      await expect(page.locator('.team-links .sidebar-link>span').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const inbox = page.locator('.sidebar-link[href="/inbox"]');
      const titleStyle = await page.getByLabel('Issue title', { exact: true }).evaluate(element => {
        const style = getComputedStyle(element);
        return { variation: style.fontVariationSettings, tracking: style.letterSpacing, visible: element.clientHeight, content: element.scrollHeight };
      });
      expect(titleStyle.variation, 'native issue titles pin the Inter optical size to 32').toBe('"opsz" 32');
      expect(titleStyle.tracking).toBe('-0.16px');
      expect(titleStyle.content, 'the title remains readable after changing text size').toBeLessThanOrEqual(titleStyle.visible);
      measurements[size] = {
        settings, settingsDescription, settingsControl,
        sidebar: await font(inbox.locator('span').first()),
        teamName: await font(page.locator('.team-heading strong').first()),
        teamNavigation: await font(page.locator('.team-links .sidebar-link>span').first()),
        title: await font(page.getByLabel('Issue title', { exact: true })),
        editor: await font(editor.locator('p')),
        sidebarWidth: await dimension(page.locator('.sidebar'), 'width'),
        tabHeight: await dimension(page.locator('.tab-strip'), 'height'),
        iconWidth: await dimension(inbox.locator('svg'), 'width'),
        teamIconWidth: await dimension(page.locator('.team-heading>button:first-child>.icon').first(), 'width'),
      };
      await page.getByRole('button', { name: / Workspace Menu$/ }).click();
      const menu = page.getByRole('menuitem', { name: /Invite and manage members/ });
      await expect(menu).toBeVisible();
      measurements[size].menu = await font(menu);
      if (size === 'Larger') {
        await testInfo.attach('larger-issue-menu', { body: await page.screenshot(), contentType: 'image/png' });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
        const overflow = await page.locator('.issue-article').evaluate(element => element.scrollWidth - element.clientWidth);
        expect(overflow, 'Larger content stays inside its existing column').toBeLessThanOrEqual(1);
      }
      await page.keyboard.press('Escape');
    }
    const text = ['settings', 'settingsDescription', 'settingsControl', 'sidebar', 'teamName', 'teamNavigation', 'title', 'editor', 'menu'];
    // Matched-viewport projects-before native capture measures sidebar icons at 14px.
    expect(measurements.Default).toMatchObject({ settings: 13, settingsDescription: 12, settingsControl: 13, sidebar: 13, teamName: 13, teamNavigation: 13, title: 24, editor: 15, menu: 13, sidebarWidth: 244, iconWidth: 14, teamIconWidth: 14 });
    expect(measurements.Default.tabHeight).toBeGreaterThan(0);
    for (const key of text) {
      for (const size of ['Smaller', 'Small', 'Large', 'Larger'] as const) {
        expect.soft(measurements[size][key], `${key}: ${size} scales actual text`).toBeCloseTo(measurements.Default[key] * roots[size] / 16, 2);
      }
      expect.soft(measurements.Restored[key], `${key}: restoring Default retains dimensions`).toBeCloseTo(measurements.Default[key], 2);
    }
    for (const size of ['Smaller', 'Small', 'Large', 'Larger', 'Restored']) for (const key of ['sidebarWidth', 'tabHeight', 'iconWidth', 'teamIconWidth']) {
      expect.soft(measurements[size][key], `${size}: ${key} stays stable`).toBeCloseTo(measurements.Default[key], 2);
    }
    await page.goto(url + '/settings');
    await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('Default');
    for (const enabled of [false, true, false]) {
      await page.goto(url + '/settings');
      const toggle = page.getByRole('switch', { name: 'Use pointer cursors', exact: true });
      await expect(toggle).toBeVisible();
      if (cursors.length === 0) await expect(toggle).toHaveAttribute('aria-checked', 'false');
      if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
      await expect.poll(async () => !!(await (await page.request.get(url + '/api/v1/state')).json()).user.preferences.pointerCursor).toBe(enabled);
      const cursor = (locator: Locator) => locator.evaluate(element => getComputedStyle(element).cursor);
      const values: Record<string, string> = {
        preference: enabled ? 'on' : 'off',
        settingsToggle: await cursor(toggle),
        settingsSelect: await cursor(page.getByLabel('Font size', { exact: true })),
      };
      await page.goto(url + '/issues/' + issue.id);
      await expect(page.getByLabel('Issue title', { exact: true })).toHaveValue(issue.title);
      values.sidebarLink = await cursor(page.locator('.sidebar-link[href="/inbox"]'));
      values.workspaceButton = await cursor(page.getByRole('button', { name: / Workspace Menu$/ }));
      cursors.push(values);
      for (const key of ['settingsToggle', 'settingsSelect', 'sidebarLink', 'workspaceButton']) {
        expect.soft(values[key], `${key} follows explicit pointer ${values.preference}`).toBe(enabled ? 'pointer' : 'default');
      }
      await page.goto(url + '/project/' + project.id);
      const grip = page.getByRole('region', { name: 'Project overview milestones', exact: true }).getByRole('button', { name: 'Reorder Draggable milestone', exact: true });
      await expect(grip).toBeAttached();
      await grip.focus();
      await expect(grip).toBeFocused();
      values.milestoneGrip = await cursor(grip);
      expect.soft(values.milestoneGrip, `real milestone drag handle retains grab when pointer is ${values.preference}`).toBe('grab');
    }
    await testInfo.attach('font-preference-measurements', { body: JSON.stringify({ rendererSha256: createHash('sha256').update(await readFile(resolve(staticDir, 'index.html'))).digest('hex'), measurements, cursors, errors }, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
  } finally { await page.close(); await app.close(); }
});

test('font size migrates once, stays local to a browser, and updates its other tabs',async({page,context,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let other;
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Local type',email:'local-type@example.test',password:'font-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 expect((await page.request.patch(url+'/api/v1/users/'+state.user.id,{data:{preferences:{...state.user.preferences,fontSize:'Large'}}})).ok()).toBeTruthy();
 await page.goto(url+'/settings');await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('Large');
 const auth=await context.storageState();other=await browser.newContext({storageState:{cookies:auth.cookies,origins:[]}});const remote=await other.newPage();await remote.goto(url+'/settings');await expect(remote.getByLabel('Font size',{exact:true})).toHaveValue('Large');
 const sibling=await context.newPage();await sibling.goto(url+'/settings');await expect(sibling.getByLabel('Font size',{exact:true})).toHaveValue('Large');
 await page.getByLabel('Font size',{exact:true}).selectOption('Small');await expect(sibling.getByLabel('Font size',{exact:true})).toHaveValue('Small');await expect(remote.getByLabel('Font size',{exact:true})).toHaveValue('Large');
 await page.reload();await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('Small');
 await remote.getByLabel('Font size',{exact:true}).selectOption('Default');await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('Small');
 expect((await(await page.request.get(url+'/api/v1/state')).json()).user.preferences.fontSize).toBe('Large');
 expect((await page.request.patch(url+'/api/v1/users/'+state.user.id,{data:{preferences:{...state.user.preferences,fontSize:'Larger'}}})).ok()).toBeTruthy();await page.reload();await remote.reload();await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('Small');await expect(remote.getByLabel('Font size',{exact:true})).toHaveValue('Default');
 }finally{if(other)await other.close();await page.close();await app.close()}
});
