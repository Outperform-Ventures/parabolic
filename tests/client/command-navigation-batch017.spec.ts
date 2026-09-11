import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('issue command context, keyboard ownership and relation dispatch survive reload without stale state',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Command navigation',email:'command-navigation@example.test',password:'command-navigation-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const first=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Command source',teamId:team.id}})).json();
  const second=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Command target',teamId:team.id}})).json();
  await page.goto(url+'/issues/'+first.id);await expect(page.locator('.issue-detail-view')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');let input=page.getByRole('combobox',{name:'Command menu',exact:true});await expect(input).toBeFocused();
  await expect(page.getByRole('option',{name:'Mark issue as…',exact:true})).toHaveCount(1);
  await expect(page.getByRole('option',{name:'Remove all subscribers',exact:true})).toHaveCount(0);
  await expect(page.getByRole('option',{name:'Find in view…',exact:true})).toHaveCount(0);
  const firstActive=await input.getAttribute('aria-activedescendant');await input.press('ArrowDown');expect(await input.getAttribute('aria-activedescendant')).not.toBe(firstActive);
  await input.fill('Mark issue as');await input.press('Enter');let dialog=page.getByRole('dialog',{name:'Mark issue as',exact:true});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Blocking…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog.getByRole('combobox',{name:'Command menu',exact:true})).toHaveAttribute('placeholder','Search for issue — blocking…');await dialog.getByRole('option',{name:new RegExp('Command target$')}).click();
  await expect.poll(()=>app.repo.raw('issues',first.id)?.relations).toContainEqual({type:'blocks',issueId:second.id});
  await page.reload();await expect(page.locator('.issue-detail-view')).toBeVisible();await page.keyboard.press('ControlOrMeta+k');input=page.getByRole('combobox',{name:'Command menu',exact:true});
  await expect(input).toHaveValue('');await expect(page.locator('.workspace-command-palette .menu-label').filter({hasText:first.identifier})).toBeVisible();await input.fill('stale query');await input.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');await expect(page.getByRole('combobox',{name:'Command menu',exact:true})).toHaveValue('');
 }finally{await page.close();await app.close();}
});

test('retained native navigation commands use real shell actions',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Shell commands',email:'shell-commands@example.test',password:'shell-command-password'}});await page.goto(url+'/my-issues');await expect(page.getByRole('heading',{name:'My issues',exact:true})).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');let input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('Open recently viewed');await input.press('Enter');await expect(page.getByText('Recently viewed',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('Create or join a workspace');await input.press('Enter');
  await expect(page.getByRole('dialog',{name:'Create or join a workspace',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('Open settings…');await input.press('Enter');await expect(page).toHaveURL(/\/settings$/);
  await page.goto(url+'/my-issues');await expect(page.getByRole('heading',{name:'My issues',exact:true})).toBeVisible();await page.keyboard.press('ControlOrMeta+t');await page.keyboard.press('ControlOrMeta+t');await expect(page.locator('.app-tab')).toHaveCount(3);await page.locator('.app-tab').first().click();
  await page.keyboard.press('ControlOrMeta+k');input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('Close tabs to the right');await input.press('Enter');await expect(page.locator('.app-tab')).toHaveCount(1);
  await page.keyboard.press('o');await page.keyboard.press('s');await expect(page).toHaveURL(/\/settings$/);
 }finally{await page.close();await app.close();}
});

test('command status and recently viewed links preserve retained native semantics',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Recent navigation',email:'recent-navigation@example.test',password:'recent-navigation-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Honey Rock Group',teamIds:[team.id]}})).json();
  const view=await(await page.request.post(url+'/api/v1/views',{data:{name:'Triage',entityType:'issues',teamId:team.id,visibility:'workspace'}})).json();
  await page.goto(url+'/project/'+project.id);await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Honey Rock Group');
  await page.goto(url+'/team/'+team.id+'/overview');await expect(page.getByRole('heading',{name:team.name,exact:true})).toBeVisible();
  await page.goto(url+'/view/'+view.id);await expect(page.getByRole('heading',{name:'Triage',exact:true})).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette=page.locator('.workspace-command-palette');await expect(palette.getByRole('status')).toHaveText('Showing all items');
  const input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('recently viewed');await expect(palette.getByRole('status')).toHaveText(/\d+ items/);await input.press('Escape');
  const trigger=page.locator('button[aria-label="Open recently viewed dialog"]');await expect(trigger).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+k');const reopen=page.getByRole('combobox',{name:'Command menu',exact:true});await reopen.fill('Open recently viewed');await reopen.press('Enter');
  const menu=page.getByRole('menu');await expect(menu.getByRole('menuitem',{name:'View Triage',exact:true})).toHaveAttribute('href','/view/'+view.id);
  await expect(menu.getByRole('menuitem',{name:'Team '+team.name,exact:true})).toHaveAttribute('href','/team/'+team.id+'/overview');
  await expect(menu.getByRole('menuitem',{name:'Project Honey Rock Group',exact:true})).toHaveAttribute('href','/project/'+project.id);
 }finally{await page.close();await app.close();}
});
