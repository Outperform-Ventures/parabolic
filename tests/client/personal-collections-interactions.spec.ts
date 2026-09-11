import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

for(const tab of ['Created','Subscribed','Activity'])test(`My issues ${tab} keeps row and toolbar popovers scoped to the collection`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Personal collection owner',email:`personal-${tab.toLowerCase()}@example.test`,password:'personal-collection-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json());
  const created=await page.request.post(url+'/api/v1/issues',{data:{title:`${tab} interaction fixture`,teamId:state.teams[0].id,assigneeId:state.user.id,subscriberIds:[state.user.id],estimate:3}});
  expect(created.ok(),await created.text()).toBeTruthy();
  await page.goto(`${url}/my-issues?tab=${tab}`);
  const row=page.getByTestId('issue-row');await expect(row).toHaveCount(1);

  await row.hover();await expect(row.locator('.row-checkbox')).toHaveCSS('opacity','1');
  const status=row.getByRole('button',{name:'Change status',exact:true});await status.click();
  await expect(page.locator('[data-property-menu=statusId]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('tab')).toBe(tab);
  await page.keyboard.press('Escape');await expect(status).toBeFocused();

  await row.click({button:'right'});const context=page.locator('.issue-context-menu');
  await expect(context).toBeVisible();await expect(context).toContainText('Status');await expect(context).toContainText('Priority');
  await expect(page.getByRole('toolbar',{name:'Selected issues'})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(context).toHaveCount(0);

  await page.getByRole('button',{name:'Display options',exact:true}).click();
  await expect(page.locator('.display-options:visible')).toBeVisible();await expect(page.getByLabel('Grouping',{exact:true})).toBeVisible();
  const expected={Created:['none','createdAt','desc'],Subscribed:['none','createdAt','desc'],Activity:['activityAt','activityAt','desc']}[tab]!;
  await expect(page.getByLabel('Grouping',{exact:true})).toHaveValue(expected[0]);
  await expect(page.getByLabel('Ordering',{exact:true})).toHaveValue(expected[1]);
  await expect(page.getByRole('button',{name:'Sort direction',exact:true})).toHaveAttribute('title',expected[2]==='asc'?'Ascending':'Descending');
  if(tab==='Activity')await expect(page.getByLabel('Ordering',{exact:true})).toContainText('My activity date');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Add filter',exact:true})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('tab')).toBe(tab);
 }finally{await app.close()}
});
