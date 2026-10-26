import { test, expect, type Locator } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

async function pointer(locator: Locator) {
  await locator.hover();
  await expect.soft(locator).toHaveCSS('cursor', 'pointer');
  // Text and icon children must inherit the clickable surface's cursor.
  for (const child of await locator.locator(':scope > span, :scope > svg').all()) {
    if (await child.isVisible()) await expect.soft(child).toHaveCSS('cursor', 'pointer');
  }
}

test('pointer is the default across navigation, rows, menus, forms and settings', async ({ page }) => {
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Cursor reviewer', email: 'cursor@example.test', password: 'isolated-cursor-test',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json(), team = state.teams[0];
    const project = await (await page.request.post(url + '/api/v1/projects', { data: {
      name: 'Cursor test project', teamIds: [team.id],
    } })).json();
    const issue = await (await page.request.post(url + '/api/v1/issues', { data: {
      title: 'Cursor test issue', teamId: team.id, projectId: project.id,
    } })).json();
    await page.request.post(url + '/api/v1/favorites', { data: {
      type: 'team', entityKind: 'teams', entityId: team.id, section: 'active',
      label: 'Active issues ' + team.name, route: '/team/' + team.id + '/active',
    } });
    await page.goto(url + '/team/' + team.id + '/all');
    await expect(page.locator('html')).toHaveAttribute('data-pointer', 'pointer');
    for (const selector of ['.sidebar-link', 'button.sidebar-section-title', '.favorite-section-heading > button',
      '.sidebar-teams-heading > button', '.team-heading > button', '.issue-row', '.page-tabs > a']) {
      await pointer(page.locator(selector).first());
    }
    await page.locator('.sidebar').getByRole('button', { name: 'More workspace views' }).click();
    await pointer(page.getByRole('menuitem', { name: 'Members', exact: true }));
    await page.keyboard.press('Escape');
    await page.goto(url + '/projects');
    await pointer(page.locator('[data-project-row="' + project.id + '"]'));
    await pointer(page.getByRole('checkbox', { name: 'Select project Cursor test project', exact: true }));
    await pointer(page.locator('.project-control').first());
    await page.goto(url + '/issues/' + issue.id);
    await pointer(page.locator('.property-button').first());
    await expect(page.getByRole('textbox', { name: 'Issue title', exact: true })).not.toHaveCSS('cursor', 'pointer');
    await expect(page.locator('.issue-article .tiptap').first()).toHaveCSS('cursor', 'text');
    await expect(page.getByRole('button', { name: 'Submit comment', exact: true })).toHaveCSS('cursor', 'default');

    await page.goto(url + '/settings/preferences');
    const toggle = page.getByRole('switch', { name: 'Use pointer cursors', exact: true });
    await expect(toggle).toBeChecked();
    await pointer(toggle);
    await pointer(page.locator('.feature-settings-nav a').first());
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-pointer', 'default');
    await expect.poll(async () => {
      const current = await (await page.request.get(url + '/api/v1/state')).json();
      return current.users.find((user: any) => user.id === current.user.id)?.preferences?.pointerCursor;
    }).toBe(false);
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect.poll(async () => {
      const current = await (await page.request.get(url + '/api/v1/state')).json();
      return current.users.find((user: any) => user.id === current.user.id)?.preferences?.pointerCursor;
    }).toBe(true);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-pointer', 'pointer');

    // Exercise shared semantics and exceptions without altering workspace data.
    // Image-editor styles are lazy-loaded only when an attachment is opened.
    await page.addStyleTag({ path: resolve('src/client/components/editor-blocks.css') });
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'cursor-fixture';
      fixture.innerHTML = `<button disabled id="disabled-control">Disabled</button>
        <div role="button" aria-disabled="true" id="disabled-aria"><button id="disabled-child">Child</button></div>
        <span class="dropdown-trigger" id="disabled-trigger"><button disabled>Disabled trigger</button></span>
        <fieldset disabled><button id="disabled-fieldset">Disabled fieldset</button></fieldset>
        <select id="select-control"><option>Option</option></select>
        <label id="check-label"><input type="checkbox" id="check-control">Check</label>
        <details><summary id="summary-control">Summary</summary></details>
        <button class="sidebar-reorder-handle" id="drag-control">Drag</button>
        <div class="rich-content"><span data-resize-handle="bottom-right" id="resize-control"></span></div>
        <button class="timeline-milestone" id="milestone-control">Milestone</button>
        <div class="archive-row" id="archive-control">Archived</div>
        <div class="board-card" id="card-control">Issue card</div>
        <div class="app-tab" id="tab-control">Tab</div>
        <div data-clickable="true" id="custom-control">Custom action</div>`;
      document.body.append(fixture);
    });
    for (const id of ['disabled-control', 'disabled-aria', 'disabled-child', 'disabled-trigger', 'disabled-fieldset']) {
      await expect(page.locator('#' + id)).toHaveCSS('cursor', 'default');
    }
    for (const id of ['select-control', 'check-label', 'check-control', 'summary-control', 'milestone-control',
      'archive-control', 'card-control', 'tab-control', 'custom-control']) {
      await expect(page.locator('#' + id)).toHaveCSS('cursor', 'pointer');
    }
    await expect(page.locator('#drag-control')).toHaveCSS('cursor', 'grab');
    await expect(page.locator('#resize-control')).toHaveCSS('cursor', 'nwse-resize');
  } finally {
    await page.close();
    await app.close();
  }
});
