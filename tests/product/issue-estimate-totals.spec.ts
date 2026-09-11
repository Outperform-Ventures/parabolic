import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('group, summary and selection totals honor unestimated configuration and explicit zero',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'totals@example.test',password:'estimate-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0],status=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='unstarted');
  for(const [index,estimate] of [null,0,3].entries())await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,statusId:status.id,title:'Estimate '+index,estimate}});
  await page.goto(url+'/team/'+team.id+'/all');const rows=page.locator('[data-testid=issue-row]');await expect(rows).toHaveCount(3);
  const header=page.locator('.group-header').filter({hasText:'Todo'}),count=header.locator('.group-count');await count.click();await expect(count).toHaveText('4');
  await page.getByRole('button',{name:'Open details',exact:true}).click();const summary=page.getByRole('complementary',{name:'Issue summary'});await expect(summary.getByRole('button',{name:'No assignee: 4 estimate points. Show issue counts',exact:true})).toBeVisible();
  for(const row of await rows.all()){await row.hover();await row.locator('.row-checkbox').click();}const selected=page.locator('.selection-estimate');await expect(selected).toHaveText('4');
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{unestimatedAsOne:false}});await page.reload();await expect(count).toHaveText('3');
  await page.getByRole('button',{name:'Open details',exact:true}).click();await expect(summary.getByRole('button',{name:'No assignee: 3 estimate points. Show issue counts',exact:true})).toBeVisible();
  for(const row of await rows.all()){await row.hover();await row.locator('.row-checkbox').click();}await expect(selected).toHaveText('3');
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{estimateScale:'T-shirt'}});await page.reload();
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('button',{name:'Display estimate',exact:true}).click();await page.keyboard.press('Escape');
  await expect(page.locator('.issue-estimate')).toHaveText(['0','M']);await expect(count).toHaveText('3');
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');
  await expect(page.locator('.board-card').filter({hasText:'Estimate 2'}).locator('.board-card-properties')).toContainText('M');
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('menuitem',{name:'Estimate',exact:true}).click();
  await expect(page.getByRole('menuitem',{name:'XS',exact:true})).toBeVisible();await expect(page.getByRole('menuitem',{name:'16',exact:true})).toHaveCount(0);
  await page.getByRole('menuitem',{name:'M',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('.board-card')).toHaveCount(1);await expect(page.locator('.issue-filter-chips')).toContainText('M');
 }finally{await page.close();await app.close()}
});
