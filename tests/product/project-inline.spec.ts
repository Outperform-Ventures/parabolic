import {test, expect, type Page} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

let app: ReturnType<typeof createApp>, base: string;
test.beforeEach(async ({page}) => {
  page.setDefaultTimeout(12_000);
  app = createApp({databasePath: ':memory:', host: '127.0.0.1', port: 0, staticDir: resolve('dist')});
  base = (await app.start()).url;
  const response = await page.request.post(base + '/auth/setup', {data: {name: 'Inline Owner', email: 'inline@example.test', password: 'inline-project-password', workspaceName: 'Inline projects'}});
  expect(response.ok(), await response.text()).toBeTruthy();
});
test.afterEach(async () => {await app.close()});
const state = async (page: Page) => (await page.request.get(base + '/api/v1/state')).json();
const saved = async (page: Page, id: string) => (await page.request.get(base + '/api/v1/projects/' + id)).json();
async function create(page: Page, kind: string, data: Record<string, unknown>) {
  const response = await page.request.post(base + '/api/v1/' + kind, {data});
  expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
}
const rowFor = (page: Page, name: string) => page.getByRole('row').filter({has: page.getByRole('cell', {name, exact: true})});

test('inline priority, lead, custom status and icon changes persist without navigating; row navigation still works', async ({page}, testInfo) => {
  const initial = await state(page), team = initial.teams[0];
  const projectStatuses = ['backlog','planned','started','completed','canceled'].map((type, index) => ({id: type, name: type === 'started' ? 'Reviewing' : type === 'planned' ? 'Scheduled' : type, type, color: '#858699', sortOrder: index}));
  expect((await page.request.patch(base + '/api/v1/workspaces/' + initial.workspaceId, {data: {projectStatuses}})).ok()).toBeTruthy();
  const project = await create(page, 'projects', {name: 'Editable delivery', teamIds: [team.id], status: 'planned'});
  await page.goto(base + '/projects'); const row = rowFor(page, project.name);
  const priority = row.getByRole('button', {name: 'Change project priority', exact: true});
  await priority.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog', {name: 'Change Priority', exact: true})).toBeVisible(); await expect(page).toHaveURL(base + '/projects');
  await page.keyboard.press('1'); await expect.poll(async () => (await saved(page, project.id)).priority).toBe(1); await expect(priority).toBeFocused();
  await priority.click(); await page.keyboard.press('Escape'); await expect(priority).toBeFocused();
  await row.getByRole('button', {name: 'Change project lead', exact: true}).click(); await page.getByRole('combobox', {name: 'Search lead', exact: true}).fill('Inline Owner'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await saved(page, project.id)).leadId).toBe(initial.user.id);
  await row.getByRole('button', {name: 'Change project status', exact: true}).click(); await page.getByRole('combobox', {name: 'Search status', exact: true}).fill('Reviewing'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await saved(page, project.id)).status).toBe('started'); await expect(page).toHaveURL(base + '/projects');
  await row.getByRole('button', {name: 'Change project icon', exact: true}).click(); const icons = page.getByRole('dialog', {name: 'Change project icon', exact: true});
  await icons.getByRole('button', {name: 'Choose Diamond icon', exact: true}).click(); await expect.poll(async () => (await saved(page, project.id)).icon).toBe('Diamond'); await page.keyboard.press('Escape');
  await row.getByRole('button', {name: 'Change project lead', exact: true}).click(); await page.keyboard.press('0'); await expect.poll(async () => (await saved(page, project.id)).leadId).toBeNull();
  await page.reload(); await expect(row.locator('.project-cell-priority')).toHaveAttribute('title', 'Urgent'); await expect(row.locator('.project-cell-status')).toHaveAttribute('title', /Reviewing/);
  await page.screenshot({path: testInfo.outputPath('project-inline-properties.png')});
  await row.getByRole('button', {name: 'Change project status', exact: true}).click(); await page.keyboard.press('4'); await expect.poll(async () => (await saved(page, project.id)).completedAt).toBeTruthy();
  await row.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(base + '/project/' + project.id);
});

test('inline target date supports every precision, validates project bounds, and removes dates durably', async ({page}) => {
  const initial = await state(page), project = await create(page, 'projects', {name: 'Dated delivery', teamIds: [initial.teams[0].id], startDate: '2027-01-15'});
  await page.goto(base + '/projects'); const row = rowFor(page, project.name), trigger = row.getByRole('button', {name: 'Change project target date', exact: true});
  await trigger.click(); const picker = page.getByRole('dialog', {name: 'Target date', exact: true});
  await picker.getByRole('textbox', {name: 'Enter target date', exact: true}).fill('2027-01-14'); await page.keyboard.press('Enter'); await expect(picker.getByRole('alert')).toContainText('on or after'); expect((await saved(page, project.id)).targetDate).toBeFalsy(); await page.keyboard.press('Escape');
  for (const [input, value, precision] of [['2027-02-20','2027-02-20','day'],['May 2027','2027-05-31','month'],['Q3 2027','2027-09-30','quarter'],['H2 2027','2027-12-31','half-year'],['2028','2028-12-31','year']]) {
    await trigger.click(); await picker.getByRole('textbox', {name: 'Enter target date', exact: true}).fill(input); await page.keyboard.press('Enter');
    await expect.poll(async () => {const result = await saved(page, project.id); return [result.targetDate?.slice(0,10), result.datePrecision]}).toEqual([value, precision]); await expect(trigger).toBeFocused(); await expect(page).toHaveURL(base + '/projects');
  }
  await page.reload(); await expect(trigger).toHaveText('2028'); await expect(trigger).toHaveCSS('font-size','12px'); await expect(trigger).toHaveCSS('font-weight','450'); await expect(trigger).toHaveCSS('height','28px'); await trigger.click(); await picker.getByRole('button', {name: 'Remove date', exact: true}).click(); await expect.poll(async () => (await saved(page, project.id)).targetDate).toBeNull();
  await page.getByRole('button', {name: 'Project display options', exact: true}).click(); await page.getByRole('checkbox', {name: 'Start date', exact: true}).check(); await page.keyboard.press('Escape');
  await row.getByRole('button', {name: 'Change project start date', exact: true}).click(); const start = page.getByRole('dialog', {name: 'Start date', exact: true}); await expect(start.getByRole('tab')).toHaveText(['Day','Month','Quarter','Half-year','Year']); await start.getByRole('textbox', {name: 'Enter start date', exact: true}).fill('2027-02-01'); await page.keyboard.press('Enter'); await expect.poll(async () => (await saved(page, project.id)).startDate?.slice(0,10)).toBe('2027-02-01');
});

test('inline multi-team editing updates summary counts and survives reload', async ({page}) => {
  const initial = await state(page), team = initial.teams[0], other = await create(page, 'teams', {name: 'Partner delivery', key: 'PIN'});
  const project = await create(page, 'projects', {name: 'Shared delivery', teamIds: [team.id]}); await page.goto(base + '/projects'); const row = rowFor(page, project.name);
  await page.getByRole('button', {name: 'Project display options', exact: true}).click(); await page.getByRole('checkbox', {name: 'Teams', exact: true}).check(); await page.keyboard.press('Escape');
  await row.getByRole('button', {name: 'Change project teams', exact: true}).click(); const picker = page.getByRole('dialog', {name: 'Change Teams', exact: true});
  await picker.getByRole('combobox').fill('Partner'); await page.keyboard.press('Enter'); await expect(picker).toBeVisible(); await expect.poll(async () => (await saved(page, project.id)).teamIds).toEqual(expect.arrayContaining([team.id, other.id])); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Open project summary', exact: true}).click(); const summary = page.getByRole('complementary', {name: 'Project summary', exact: true}); await summary.getByRole('tab', {name: 'Teams', exact: true}).click(); await expect(summary.getByRole('button', {name: 'Filter by Partner delivery', exact: true})).toContainText('1');
  await row.getByRole('button', {name: 'Change project teams', exact: true}).click(); await picker.getByRole('combobox').fill(team.name); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await expect.poll(async () => (await saved(page, project.id)).teamIds).toEqual([other.id]); await expect(summary.getByRole('button', {name: 'Filter by ' + team.name, exact: true})).toHaveCount(0); await page.reload(); await expect(row.getByRole('button', {name: 'Change project teams', exact: true})).toHaveText('Partner delivery');
});
