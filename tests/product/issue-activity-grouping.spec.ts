import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('status history expands, retains individual permalinks and updates relative labels',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'History owner',email:'history@example.test',password:'test-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
  const statuses=state.statuses.filter((s:any)=>s.teamId===team.id),backlog=statuses.find((s:any)=>s.type==='backlog')??statuses[0],started=statuses.find((s:any)=>s.type==='started'),done=statuses.find((s:any)=>s.type==='completed');
  expect(started).toBeTruthy();expect(done).toBeTruthy();
  const issue=await page.request.post(url+'/api/v1/issues',{data:{title:'Grouped history',teamId:team.id,statusId:backlog.id}}).then(r=>r.json());
  await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{statusId:started.id}});
  await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{statusId:done.id}});
  await page.clock.install();
  await page.goto(url+'/issues/'+issue.id);
  const group=page.locator('.activity-status-group');await expect(group).toHaveCount(1);
  const toggle=group.getByRole('button',{name:'Expand status changes',exact:true});await toggle.click();
  const children=group.locator('.activity-status-children .activity-event');await expect(children).toHaveCount(2);
  await expect(children.first()).toContainText(`moved from ${backlog.name} to ${started.name}`);
  await expect(children.last()).toContainText(`moved from ${started.name} to ${done.name}`);
  expect(await children.first().locator('strong').allTextContents()).toEqual(['History owner',backlog.name,started.name]);
  const href=await children.first().locator('.activity-event-permalink').getAttribute('href');
  await group.getByRole('button',{name:'Collapse status changes',exact:true}).click();await expect(children).toHaveCount(0);
  await page.goto(url+href);await expect(children).toHaveCount(2);
  await page.clock.fastForward(125000);await expect(children.first().locator('time')).toHaveText('2 minutes ago');
  await expect(group.locator(':scope > .activity-event time')).toHaveText('2min ago');
  const geometry=await group.evaluate(el=>{const child=el.querySelector('.activity-status-children')!,row=child.firstElementChild!;return {indent:child.getBoundingClientRect().x-el.getBoundingClientRect().x,height:row.getBoundingClientRect().height};});
  expect(geometry.indent).toBe(25);expect(geometry.height).toBeCloseTo(28.796875,2);
  await page.screenshot({path:'artifacts/verification/issue-filter-parity/activity-grouped-isolated-129.png'});
 }finally{await page.close();await app.close();}
});
