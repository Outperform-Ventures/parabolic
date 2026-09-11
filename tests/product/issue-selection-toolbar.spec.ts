import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('selection toolbar totals, command context and bulk return to backlog',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'toolbar@example.test',password:'selection-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0],started=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='started'),backlog=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='backlog');
  const issues=[];for(const estimate of [3,5])issues.push(await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Toolbar '+estimate,statusId:started.id,estimate}}).then(r=>r.json()));
  await page.goto(url+'/team/'+team.id+'/active');const rows=page.locator('[data-testid=issue-row]'),bar=page.getByRole('toolbar',{name:'Selected issues'});
  await expect(rows).toHaveCount(2);for(const row of await rows.all()){await row.hover();await row.locator('.row-checkbox').click();}
  await expect(bar).toContainText('2 selected');await expect(bar.locator('.selection-estimate')).toHaveText('8');
  await expect(bar).toHaveCSS('height','44px');await expect(bar.locator('.property-button')).toHaveCount(0);
  await bar.getByRole('button',{name:'Open command menu'}).click();await expect(page.getByLabel('Command menu',{exact:true})).toBeVisible();await page.getByLabel('Command menu',{exact:true}).fill('Change priority');await expect(page.getByRole('option',{name:'Change priority',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await expect(bar).toBeVisible();await bar.getByRole('button',{name:'Move to Backlog',exact:true}).click();await expect(rows).toHaveCount(0);await expect(bar).toHaveCount(0);
  for(const issue of issues){const saved=await page.request.get(url+'/api/v1/issues/'+issue.id).then(r=>r.json());expect(saved.statusId).toBe(backlog.id);}
  await page.goto(url+'/team/'+team.id+'/backlog');await expect(rows).toHaveCount(2);for(const row of await rows.all()){await row.hover();await row.locator('.row-checkbox').click();}
  await bar.getByRole('button',{name:'Move to Active',exact:true}).click();await expect(rows).toHaveCount(0);await expect(bar).toHaveCount(0);
  const todo=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='unstarted');for(const issue of issues){const saved=await page.request.get(url+'/api/v1/issues/'+issue.id).then(r=>r.json());expect(saved.statusId).toBe(todo.id);}
 }finally{await page.close();await app.close();}
});
