import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test.use({serviceWorkers:'block',colorScheme:'dark'});

test('issue Filter Escape closes one cascade level before restoring the trigger',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Filter cascade owner',email:'filter-cascade@example.test',password:'filter-cascade-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  await page.goto(url+'/team/'+team.id+'/backlog');
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true});
  await trigger.click();
  const status=page.getByRole('menuitem',{name:'Status',exact:true});
  await status.click();
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(2);
  await expect(page.locator('.filter-cascade-panel').last().getByRole('textbox',{name:'Status',exact:true})).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(1);
  await expect(status).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(1);
  await page.mouse.click(8,8);
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(0);
 }finally{await page.close();await app.close()}
});

test('issue Filter Escape closes a child opened from root search and restores the trigger',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Filter search owner',email:'filter-search-cascade@example.test',password:'filter-search-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  await page.goto(url+'/team/'+team.id+'/backlog');
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true});
  await trigger.click();
  await page.getByRole('textbox',{name:'Add filter',exact:true}).fill('Status');
  await page.getByRole('menuitem',{name:'Status',exact:true}).click();
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(0);
  await expect(trigger).toBeFocused();
 }finally{await page.close();await app.close()}
});
