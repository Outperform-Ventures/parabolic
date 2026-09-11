import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('workspace filters merge shared statuses and combine multiple fields',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try {
  await page.request.post(url+'/auth/setup',{data:{name:'Filter owner',email:'multiple-filter@example.test',password:'test-password'}});
  let state=await page.request.get(url+'/api/v1/state').then(r=>r.json());
  const firstTeam=state.teams[0],secondTeam=await page.request.post(url+'/api/v1/teams',{data:{name:'Second team',key:'SEC'}}).then(r=>r.json());
  state=await page.request.get(url+'/api/v1/state').then(r=>r.json());
  const status=(teamId:string,type:string)=>state.statuses.find((item:any)=>item.teamId===teamId&&item.type===type);
  for(const [title,teamId,statusId,priority] of [
   ['First backlog',firstTeam.id,status(firstTeam.id,'backlog').id,2],
   ['Second backlog',secondTeam.id,status(secondTeam.id,'backlog').id,2],
   ['Low backlog',firstTeam.id,status(firstTeam.id,'backlog').id,4],
   ['High todo',firstTeam.id,status(firstTeam.id,'unstarted').id,2]
  ])await page.request.post(url+'/api/v1/issues',{data:{title,teamId,statusId,priority,assigneeId:state.user.id}});
  await page.goto(url+'/my-issues?tab=Assigned');
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true});
  await trigger.click();await page.getByRole('menuitem',{name:'Status',exact:true}).click();
  const statusMenu=page.locator('.filter-cascade-panel').last();
  await expect(statusMenu.getByRole('menuitem',{name:'Backlog',exact:true})).toHaveCount(1);
  await expect(statusMenu.getByRole('menuitem',{name:'Todo',exact:true})).toHaveCount(1);
  await statusMenu.getByRole('menuitem',{name:'Backlog',exact:true}).click();
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(3);
  await trigger.click();await page.getByRole('menuitem',{name:'Priority',exact:true}).click();await page.getByRole('menuitem',{name:'High',exact:true}).click();
  await expect(page.locator('.issue-filter-chip')).toHaveCount(2);
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
  await expect(page.locator('.issue-filter-chips')).toContainText('StatusisBacklog');
  await expect(page.locator('.issue-filter-chips')).toContainText('PriorityisHigh');
 } finally {await page.close();await app.close();}
});
