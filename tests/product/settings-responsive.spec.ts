import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { createApp } from '../../src/server/app';

async function horizontalOverflow(page: Page) {
  return page.locator('.feature-settings-shell').evaluate(shell => {
    const main = shell.querySelector('.feature-settings-main')!;
    const bounds = main.getBoundingClientRect();
    const right = bounds.left + main.clientLeft + main.clientWidth;
    const dialogs = [...document.querySelectorAll<HTMLElement>('dialog, [role="dialog"]')];
    return [...shell.querySelectorAll<HTMLElement>('*'), ...dialogs.flatMap(dialog => [dialog, ...dialog.querySelectorAll<HTMLElement>('*')])].flatMap(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none' ||
          element.closest('svg, [aria-hidden="true"]') || element.tagName === 'OPTION') return [];
      const scrolls = !['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) &&
        ['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const outside = element.closest('dialog, [role="dialog"]') ? box.left < -1 || box.right > window.innerWidth + 1 :
        main.contains(element) && style.position !== 'fixed' && (box.right > right + 1 || box.left < bounds.left - 1);
      if (!scrolls && !outside) return [];
      return [{ tag: element.tagName, class: element.className, scrolls, outside,
        width: Math.round(box.width), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        text: element.textContent?.trim().slice(0, 65) }];
    });
  });
}

test('every settings page fits its panel at desktop and compact widths', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Settings layout reviewer', email: 'settings-layout@example.test', password: 'isolated-layout-test',
    } });
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const team = state.teams[0];
    await page.goto(url + '/settings');
    await expect(page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
    const routes = await page.locator('.feature-settings-nav a[href^="/settings/"]').evaluateAll(links =>
      links.map(link => link.getAttribute('href')!).filter(href => !href.includes('?')));
    await page.goto(url + '/settings/integrations');
    await expect(page.locator('.feature-provider-card').first()).toBeVisible();
    routes.push(...await page.locator('.feature-provider-card .integration-brand').evaluateAll(brands =>
      [...new Set(brands.map(brand => '/settings/integrations/' + [...brand.classList].find(name => name !== 'integration-brand')))]));
    routes.push(...['initiative-labels', 'initiative-updates', 'document-templates', 'webhooks',
      'notifications/desktop', 'notifications/mobile', 'notifications/email', 'notifications/slack',
      'integrations/github', 'integrations/slack', 'integrations/google-sheets',
    ].map(section => '/settings/' + section));
    routes.push(...['General', 'Members', 'Workflow', 'Cycles', 'Triage', 'Templates', 'Recurring issues', 'Issue labels']
      .map(section => `/settings/team-${team.id}?section=${encodeURIComponent(section)}`));
    const uniqueRoutes = [...new Set(routes)];
    const failures: object[] = [];
    for (const width of [1440, 960, 800, 610, 500]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of uniqueRoutes) {
        await page.goto(url + route);
        await expect(page.locator('.feature-settings-content')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        for (const fontSize of ['16px', '20px']) {
          await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
          const overflow = await horizontalOverflow(page);
          if (overflow.length) failures.push({ width, fontSize, route, overflow: overflow.slice(0, 10) });
        }
        if ([800, 500].includes(width) && ['/settings/slas', '/settings/project-templates', '/settings/project-statuses', '/settings/teams', '/settings/members'].includes(route)) {
          await page.screenshot({ path: testInfo.outputPath(`${width}-${route.split('/').at(-1)}.png`) });
        }
      }
    }
    await testInfo.attach('settings-pages-audit.json', { body: JSON.stringify({ routes: uniqueRoutes, failures }, null, 2), contentType: 'application/json' });
    const create = async (kind: string, data: object) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, { data });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    };
    const longName = 'A long name for customer onboarding and operations documentation';
    for (const entityType of ['issues', 'projects']) {
      await create('labels', { name: longName, description: 'Description with a long reference: ' + 'example'.repeat(18), entityType, color: '#7775df' });
    }
    const templates = [];
    for (const type of ['issue', 'project', 'document']) templates.push(await create('templates', { name: longName, type, properties: { title: 'Template content', teamId: team.id } }));
    await create('asksPages', { name: longName, slug: 'layout-requests', teamId: team.id, templateIds: [templates[0].id] });
    const populatedRoutes = ['/settings/labels', '/settings/project-labels', '/settings/initiative-labels',
      '/settings/templates', '/settings/project-templates', '/settings/documents', '/settings/asks',
      '/settings/templates?template=' + templates[0].id,
      '/settings/project-templates?template=' + templates[1].id,
      '/settings/document-templates?template=' + templates[2].id,
    ];
    for (const width of [1440, 960, 800, 610, 500]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of populatedRoutes) {
        await page.goto(url + route);
        // Document templates render a portaled editor over an intentionally
        // empty page. Wait for the form itself, not its zero-height backdrop.
        if (route.includes('?template=')) await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toBeVisible();
        else await expect(page.locator('.feature-settings-content')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        for (const fontSize of ['16px', '20px']) {
          await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
          const overflow = await horizontalOverflow(page);
          if (overflow.length) failures.push({ width, fontSize, route, populated: true, overflow: overflow.slice(0, 10) });
        }
      }
    }
    await testInfo.attach('settings-overflow-audit.json', { body: JSON.stringify({ routes: uniqueRoutes, populatedRoutes, failures }, null, 2), contentType: 'application/json' });
    console.log('Settings overflow audit:', JSON.stringify({ routes: uniqueRoutes.length, failures: failures.length }));
    expect(failures.length, 'See settings-overflow-audit.json for overflowing routes and elements').toBe(0);
  } finally {
    await page.close();
    await app.close();
  }
});

test('settings editing controls stay reachable without horizontal scrolling', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const app = createApp({ databasePath: ':memory:', port: 0, staticDir: resolve('dist') });
  const { url } = await app.start();
  try {
    await page.request.post(url + '/auth/setup', { data: {
      name: 'Settings form reviewer', email: 'settings-forms@example.test', password: 'isolated-layout-test',
    } });
    const { teams } = await (await page.request.get(url + '/api/v1/state')).json();
    const cases = [
      { route: '/settings/labels', button: 'New label' },
      { route: '/settings/labels', button: 'New group' },
      { route: '/settings/slas', button: 'Add rule' },
      { route: '/settings/project-updates', button: 'Edit' },
      { route: '/settings/initiative-updates', button: 'Edit' },
      { route: '/settings/project-statuses', button: 'Create new project status' },
      { route: '/settings/customers', button: 'Create new customer status' },
      { route: '/settings/customers', button: 'Create new customer tier' },
      { route: '/settings/customers', button: 'Add excluded domains and emails' },
      { route: '/settings/teams', button: 'Create new team' },
      { route: '/settings/members', button: 'Invite member' },
      { route: `/settings/team-${teams[0].id}?section=Workflow`, button: 'New workflow status' },
    ];
    const failures: object[] = [];
    for (const width of [960, 500]) {
      await page.setViewportSize({ width, height: 900 });
      for (const scenario of cases) {
        await page.goto(url + scenario.route);
        const trigger = page.getByRole('button', { name: scenario.button, exact: true }).first();
        await expect(trigger).toBeVisible();
        await trigger.click();
        await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
        const overflow = await horizontalOverflow(page);
        if (overflow.length) failures.push({ width, ...scenario, overflow });
        await page.screenshot({ path: testInfo.outputPath(`${width}-${scenario.button.replaceAll(' ', '-')}.png`) });
      }
    }
    await testInfo.attach('settings-form-overflow.json', { body: JSON.stringify(failures, null, 2), contentType: 'application/json' });
    expect(failures.length, 'See settings-form-overflow.json for overflowing editing controls').toBe(0);
  } finally {
    await page.close();
    await app.close();
  }
});
