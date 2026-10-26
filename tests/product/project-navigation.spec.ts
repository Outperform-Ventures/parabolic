import {test, expect, type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page: Page) {
  const app = createApp({databasePath: ':memory:', port: 0, staticDir: resolve('dist')}), {url} = await app.start();
  await page.request.post(url + '/auth/setup', {data: {name: 'Project navigation tester', email: 'project-navigation@example.test', password: 'isolated-navigation-test'}});
  const state = await (await page.request.get(url + '/api/v1/state')).json();
  const actor = {userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin']};
  await page.goto(url + '/my-issues');
  return {app, url, state, actor, storageKey: `sidebar-destinations:${state.user.id}:${state.workspaceId}`};
}
const projectDialog = (page: Page) => page.getByRole('dialog', {name: 'New project', exact: true});
const projectLink = (page: Page) => page.locator('.sidebar [data-sidebar-path="/projects"]');
const myIssuesLink = (page: Page) => page.locator('.sidebar [data-sidebar-path="/my-issues"]');

test('previously remembered creation URLs navigate to project pages without reopening a modal', async ({page}) => {
  const f = await fixture(page); try {
    const teamRoute = `/team/${f.state.teams[0].id}/projects`;
    await page.evaluate(({key, teamRoute}) => {
      localStorage.setItem(key, JSON.stringify({'/projects': '/projects/all?new=1&keep=1#projects', [teamRoute]: teamRoute + '?new=1'}));
    }, {key: f.storageKey, teamRoute});
    await page.reload();
    await projectLink(page).click();
    await expect(page).toHaveURL(f.url + '/projects/all?keep=1#projects');
    await expect(projectDialog(page)).toHaveCount(0);
    await projectLink(page).click();
    await expect(projectDialog(page)).toHaveCount(0);
    await myIssuesLink(page).click();
    await page.getByRole('complementary').getByRole('button', {name: f.state.teams[0].name, exact: true}).click();
    await page.locator(`.sidebar a[href="${teamRoute}"]`).click();
    await expect(page).toHaveURL(f.url + teamRoute);
    await expect(projectDialog(page)).toHaveCount(0);
    await myIssuesLink(page).click(); await page.reload(); await projectLink(page).click();
    await expect(page).toHaveURL(f.url + '/projects/all?keep=1#projects');
    await expect(projectDialog(page)).toHaveCount(0);
  } finally {await page.close(); await f.app.close();}
});

test('explicit creation opens once, preserves a typed name, and ordinary navigation stays modal-free', async ({page}) => {
  const f = await fixture(page); try {
    await page.goto(f.url + '/projects?new=1&keep=1#projects');
    await expect(projectDialog(page)).toBeVisible();
    await expect(page).toHaveURL(f.url + '/projects?keep=1#projects');
    await projectDialog(page).getByRole('button', {name: 'Cancel', exact: true}).click();
    await projectLink(page).click(); await expect(projectDialog(page)).toHaveCount(0);
    await myIssuesLink(page).click(); await projectLink(page).click();
    await expect(projectDialog(page)).toHaveCount(0);
    await page.reload(); await expect(projectDialog(page)).toHaveCount(0);
    await page.getByRole('button', {name: 'New project', exact: true}).click();
    await expect(projectDialog(page)).toBeVisible();
    await projectDialog(page).getByRole('button', {name: 'Cancel', exact: true}).click();
    for (const name of ['Typed project name', 'Another project name']) {
      await page.evaluate(value => window.dispatchEvent(new CustomEvent('workspace-command', {detail: {command: 'new-project', value}})), name);
      await expect(projectDialog(page).getByLabel('Project name', {exact: true})).toHaveValue(name);
      await expect(page).toHaveURL(f.url + '/projects');
      await projectDialog(page).getByRole('button', {name: 'Cancel', exact: true}).click();
    }
    expect(f.app.repo.all('projects', f.actor.workspaceId)).toHaveLength(0);
  } finally {await page.close(); await f.app.close();}
});

test('team and initiative creation context survives consuming the one-time URL', async ({page}) => {
  const f = await fixture(page); try {
    const team = f.app.repo.create(f.actor, 'teams', {name: 'Planning team', key: 'PLAN'});
    const initiative = f.app.repo.create(f.actor, 'initiatives', {name: 'Navigation initiative'});
    const route = `/team/${team.id}/projects`;
    await page.goto(f.url + route + '?new=1&initiativeId=' + initiative.id);
    await expect(projectDialog(page)).toBeVisible();
    await expect(page).toHaveURL(f.url + route);
    await projectDialog(page).getByLabel('Project name', {exact: true}).fill('Scoped creation');
    await projectDialog(page).getByRole('button', {name: 'Create project', exact: true}).click();
    await expect(projectDialog(page)).toHaveCount(0);
    const saved = f.app.repo.all('projects', f.actor.workspaceId).find(project => project.name === 'Scoped creation');
    expect(saved?.teamIds).toEqual([team.id]);
    expect(saved?.initiativeIds).toEqual([initiative.id]);
    await expect(page).toHaveURL(f.url + '/project/' + saved!.id);
    await page.goBack();
    await expect(page).toHaveURL(f.url + route);
    await expect(projectDialog(page)).toHaveCount(0);
  } finally {await page.close(); await f.app.close();}
});
