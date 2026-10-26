import { test, expect, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  await page.request.post(url + '/auth/setup', { data: {
    name: 'Tooltip Tester', email: 'tooltips@example.test', password: 'isolated-tooltip-test',
  } });
  const state = await page.request.get(url + '/api/v1/state').then(r => r.json());
  const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
  const project = app.repo.create(actor, 'projects', { name: 'Example project', teamIds: [state.teams[0].id] });
  const customer = app.repo.create(actor, 'customers', { name: 'Example customer' });
  const label = app.repo.create(actor, 'labels', { name: 'Example label' });
  const issue = app.repo.create(actor, 'issues', {
    title: 'Tooltip example issue', teamId: state.teams[0].id, projectId: project.id,
    directCustomerIds: [customer.id], labelIds: [label.id], assigneeId: state.user.id, priority: 2,
  });
  const view = app.repo.create(actor, 'views', { name: 'Tooltip fixture', entityType: 'issues', filters: { match: 'all', conditions: [] } });
  await page.goto(url + '/view/' + view.id);
  await expect(page.locator('.issue-row')).toBeVisible();
  return { app, url, issue };
}

async function noTooltip(page: Page, target: Locator) {
  await target.hover();
  // Include the cold delay; an immediate absence assertion misses the regression.
  await page.waitForTimeout(650);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(target).not.toHaveAttribute('title');
}

test('filter choices do not repeat visible names, including nested avatars and priority icons', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    for (const [field, name] of [
      ['Status', 'Todo'], ['Priority', 'High'], ['Assignee', 'Tooltip Tester'],
      ['Creator', 'Tooltip Tester'], ['Team', 'Engineering'], ['Project', 'Example project'],
      ['Customer', 'Example customer'], ['Labels', 'Example label'],
    ]) {
      await page.getByRole('button', { name: 'Filter issues', exact: true }).click();
      await page.locator('.filter-cascade-panel').first().getByRole('menuitem', { name: field, exact: true }).click();
      const menu = page.locator('.filter-cascade-panel').last();
      const option = field === 'Team' ? menu.getByRole('menuitem').first() : menu.getByRole('menuitem', { name, exact: true });
      if (field === 'Customer') {
        // The name is ellipsized beside its count: show only the missing name.
        await option.hover();
        await expect(page.getByRole('tooltip')).toHaveText(name);
      } else await noTooltip(page, option);
      const glyph = option.locator('.avatar, .priority-icon');
      if (await glyph.count()) await noTooltip(page, glyph.first());
      if (field === 'Status') await page.screenshot({ path: info.outputPath('status-menu-without-redundant-tooltip.png') });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Filter issues', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText('Filter issues');
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const summary = page.locator('[data-tooltip-variant="group-summary"]').first();
    await summary.hover();
    await expect(page.getByRole('tooltip')).toContainText(/Click to show (estimate points|issue counts)/);
    const saved = await page.request.get(f.url + '/api/v1/issues/' + f.issue.id).then(r => r.json());
    expect(saved.version).toBe(f.issue.version);
  } finally { await page.close(); await f.app.close(); }
});

test('issue property pickers suppress redundant labels without losing accessible names', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(f.url + '/issues/' + f.issue.id);
    for (const [trigger, name] of [
      ['Change status', 'Todo'], ['Change priority', 'High'], ['Change assignee', 'Tooltip Tester'],
      ['Change project', 'Example project'], ['Change customers', 'Example customer'],
    ]) {
      const button = page.getByRole('button', { name: trigger, exact: true }).first();
      await button.click();
      const option = page.locator('[data-property-menu]').getByRole('button', { name, exact: true })
        .or(page.locator('[data-property-menu]').getByRole('option', { name, exact: true }));
      await noTooltip(page, option);
      const glyph = option.locator('.avatar, .priority-icon');
      if (await glyph.count()) await noTooltip(page, glyph.first());
      await expect(option).toHaveAccessibleName(name);
      await page.keyboard.press('Escape');
    }
  } finally { await page.close(); await f.app.close(); }
});

test('shared hover policy preserves clipped labels and descriptions, not visible duplicates or hidden labels', async ({ page }) => {
  const f = await fixture(page);
  try {
    // Isolated DOM examples exercise the real global hover listener and browser layout.
    await page.evaluate(() => {
      const samples = document.createElement('section');
      samples.id = 'tooltip-samples';
      samples.style.cssText = 'position:fixed;left:300px;top:80px;width:520px;z-index:99999;background:#222;padding:20px;display:flex;flex-direction:column;align-items:start;gap:12px';
      samples.innerHTML = `
        <button id="visible" aria-label="Change status"><svg width="16" height="16"></svg><span>Todo</span><kbd>S</kbd></button>
        <button id="clipped" aria-label="Change project"><span style="display:block;width:90px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">A long project name that must remain readable</span><small>1 issue</small></button>
        <button id="icon" aria-label="Search workspace"><svg width="16" height="16"></svg><span hidden>Hidden label</span><span class="native-visually-hidden">Screen reader label</span></button>
        <button id="description" aria-label="Bug" data-tooltip="Use for customer-facing defects.">Bug</button>
        <button id="same-description" aria-label="Bug" data-tooltip="Bug">Bug</button>
        <button id="nested-description" data-tooltip="Responsible for this project."><span class="avatar" data-tooltip-label="Tooltip Tester">TT</span><span>Tooltip Tester</span></button>
        <button id="person"><span class="avatar" data-tooltip-label="Tooltip Tester">TT</span><span>Tooltip Tester</span></button>
        <button id="avatar-only" aria-label="Change assignee"><span class="avatar" data-tooltip-label="Tooltip Tester">TT</span></button>
        <span id="full-name" data-tooltip-label="Example project">Example project</span>
        <span id="short-name" data-tooltip-label="Tooltip Tester">Tooltip</span>
        <button id="expanded" aria-label="Display options" aria-expanded="true"><svg width="16" height="16"></svg></button>
        <button id="custom-hover" aria-label="Chart bar details" data-tooltip-disabled><svg width="16" height="16"></svg></button>
        <button id="native" aria-label="Help" title="Useful native help"><svg width="16" height="16"></svg></button>`;
      document.body.append(samples);
    });
    for (const id of ['visible', 'same-description', 'full-name', 'expanded', 'custom-hover']) await noTooltip(page, page.locator('#' + id));
    await noTooltip(page, page.locator('#person .avatar'));
    for (const [id, text] of [
      ['clipped', 'A long project name that must remain readable'], ['icon', 'Search workspace'],
      ['description', 'Use for customer-facing defects.'], ['nested-description .avatar', 'Responsible for this project.'],
      ['avatar-only .avatar', 'Tooltip Tester'], ['short-name', 'Tooltip Tester'],
    ]) {
      await page.locator('#' + id).hover();
      await expect(page.getByRole('tooltip')).toContainText(text);
      if (id === 'clipped') await expect(page.getByRole('tooltip')).toHaveText(text);
      await page.locator('#visible').hover();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    }
    await page.locator('#native').hover();
    await page.waitForTimeout(650);
    await expect(page.getByRole('tooltip')).toHaveCount(0); // No second tooltip over native help.
    await page.locator('#icon').hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  } finally { await page.close(); await f.app.close(); }
});
