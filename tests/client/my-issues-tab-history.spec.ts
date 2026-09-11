import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';
test('My issues tabs isolate filters/display and clear selection through history and reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'my-history@example.test',name:'History owner',password:'my-history-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const create=async(title:string,priority:number)=>{const r=await page.request.post(url+'/api/v1/issues',{data:{title,teamId:state.teams[0].id,assigneeId:state.user.id,subscribers:[state.user.id],priority}});expect(r.ok(),await r.text()).toBeTruthy();return r.json()};
  const high=await create('High personal history issue',2),low=await create('Low personal history issue',4);
  await page.goto(url+'/my-issues');
  const tab=async(name:string)=>{await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveClass(/active/);await expect(page.getByRole('toolbar',{name:'Selected issues'})).toHaveCount(0)};
  const selectRow=async(id:string)=>{await page.locator(`[data-issue-id="${id}"]`).getByRole('button',{name:/Select /}).click();await expect(page.getByRole('toolbar',{name:'Selected issues'})).toBeVisible()};
  const grouping=async(value:string)=>{await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('combobox',{name:'Grouping',exact:true}).selectOption(value);await page.keyboard.press('Escape')};
  const verifyGrouping=async(value:string)=>{await page.getByRole('button',{name:'Display options',exact:true}).click();await expect(page.getByRole('combobox',{name:'Grouping',exact:true})).toHaveValue(value);await page.keyboard.press('Escape')};
  await grouping('priority');await page.locator(`[data-issue-id="${high.id}"]`).getByRole('button',{name:/Select /}).click();await expect(page.getByRole('toolbar',{name:'Selected issues'})).toBeVisible();
  await tab('Created');await grouping('statusId');await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('menuitem',{name:'Priority',exact:true}).click();await page.getByRole('menuitem',{name:'High',exact:true}).click();await expect(page.locator(`[data-issue-id="${low.id}"]`)).toHaveCount(0);
  await tab('Subscribed');await expect(page.locator('.issue-filter-chips')).toHaveCount(0);await expect(page.locator(`[data-issue-id="${low.id}"]`)).toBeVisible();await grouping('assigneeId');await selectRow(low.id);
  await tab('Activity');await expect(page.locator('.issue-filter-chips')).toHaveCount(0);await grouping('activityAt');await selectRow(high.id);
  await page.goBack();await expect(page.getByRole('button',{name:'Subscribed',exact:true})).toHaveClass(/active/);await verifyGrouping('assigneeId');await expect(page.getByRole('toolbar',{name:'Selected issues'})).toHaveCount(0);
  await page.goBack();await expect(page.getByRole('button',{name:'Created',exact:true})).toHaveClass(/active/);await verifyGrouping('statusId');await expect(page.locator('.issue-filter-chips')).toContainText('High');await expect(page.locator(`[data-issue-id="${low.id}"]`)).toHaveCount(0);
  await selectRow(high.id);await page.reload();await verifyGrouping('statusId');await expect(page.locator('.issue-filter-chips')).toContainText('High');await expect(page.getByRole('toolbar',{name:'Selected issues'})).toHaveCount(0);
  await tab('Assigned');await verifyGrouping('priority');await expect(page.locator('.issue-filter-chips')).toHaveCount(0);await expect(page.locator(`[data-issue-id="${low.id}"]`)).toBeVisible();
  await tab('Created');await expect(page.locator('.issue-filter-chips')).toContainText('High');
 }finally{await app.close()}
});
