import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

const inventory=['Status›','Priority›','Project lead›','Members›','Start date…','Target date…','Teams›','Labels›','More properties›','Copy›','Move›','Open in›','Favorite⌥ F','Subscribe›','Remind me⇧ H','New comment…N then C','Delete'];

test('project context targets the right-clicked unselected project',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Context owner',email:'project-context-target@example.test',password:'test-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const alpha=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Alpha context',teamIds:[team.id],status:'planned',priority:1}})).json(),beta=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Beta context',teamIds:[team.id],status:'planned',priority:4}})).json();
  await page.goto(url+'/projects');
  await page.getByRole('checkbox',{name:'Select project Alpha context',exact:true}).click();
  await expect(page.locator('.project-collection')).toHaveAttribute('data-selected-project-ids',alpha.id);
  const betaRow=page.locator(`[data-project-row="${beta.id}"]`);
  await betaRow.click({button:'right'});
  const menu=page.locator('.project-context-menu:visible');
  await expect(menu.getByRole('menuitem')).toHaveText(inventory);
  await expect(page.locator('.project-collection')).toHaveAttribute('data-selected-project-ids','');
  await expect(page.locator('.project-collection')).toHaveAttribute('data-focused-project-id',beta.id);
  await menu.getByRole('menuitem',{name:/^Priority/}).click();
  const dialog=page.getByRole('dialog',{name:'Change Priority',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator(':focus')).toHaveCount(1);
  await dialog.getByRole('button',{name:'High',exact:true}).click();
  await expect.poll(()=>app.repo.raw('projects',beta.id)?.priority).toBe(2);
  expect(app.repo.raw('projects',alpha.id)?.priority).toBe(1);
 }finally{await page.close();await app.close()}
});

test('Shift-F10 context navigation closes back to the originating row',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Context keyboard',email:'project-context-keyboard@example.test',password:'test-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Keyboard context',teamIds:[state.teams[0].id],status:'planned'}})).json();
  await page.goto(url+'/projects');
  const row=page.locator(`[data-project-row="${project.id}"]`);await row.focus();await page.keyboard.press('Shift+F10');
  const menu=page.locator('.project-context-menu:visible');await expect(menu).toBeVisible();
  expect(await menu.boundingBox()).toMatchObject({width:229,height:602});
  await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('End');await expect(menu.getByRole('menuitem').last()).toBeFocused();
  await page.keyboard.press('Home');await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(row).toBeFocused();
  await row.click({button:'right'});await expect(page.locator('.project-context-menu:visible')).toBeVisible();
  await page.mouse.click(1200,900);await expect(page.locator('.project-context-menu:visible')).toHaveCount(0);await expect(row).toBeFocused();
 }finally{await page.close();await app.close()}
});
