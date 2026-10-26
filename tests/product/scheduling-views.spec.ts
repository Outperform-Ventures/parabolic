import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page:Page){
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 await page.request.post(url+'/auth/setup',{data:{name:'Schedule test',email:'schedule@example.test',password:'isolated-schedule-test'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0];
 const customer=app.repo.create(actor,'customers',{name:'Example customer'}),project=app.repo.create(actor,'projects',{name:'Example project',teamIds:[team.id],directCustomerIds:[customer.id],startDate:'2026-09-01',targetDate:'2026-09-20'});
 const issue=app.repo.create(actor,'issues',{title:'Prepare launch',teamId:team.id,projectId:project.id,startDate:'2026-09-07',dueDate:'2026-09-10',estimate:4}),next=app.repo.create(actor,'issues',{title:'Ship launch',teamId:team.id,startDate:'2026-09-11',dueDate:'2026-09-12',relations:[{type:'blockedBy',issueId:issue.id}]}),unscheduled=app.repo.create(actor,'issues',{title:'Plan follow-up',teamId:team.id});
 const view=app.repo.create(actor,'views',{name:'Launch calendar',entityType:'issues',visibility:'workspace',layout:'Calendar',filters:{match:'all',conditions:[]},display:{layout:'calendar',scheduleAnchor:'2026-09-12',showEmpty:false,groupBy:'none'}});
 const route=url+'/view/'+view.id;
 await page.goto(route);await expect(page.getByRole('region',{name:'Calendar view',exact:true})).toBeVisible();
 const current=(id=issue.id)=>app.repo.get(actor,'issues',id);
 return {app,url,state,actor,team,project,issue,next,unscheduled,view,route,current};
}
async function layout(page:Page,name:string){await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name,exact:true}).click();await page.keyboard.press('Escape');}

test('new issue view saves the configured calendar or timeline preview',async({page,browser})=>{
 const f=await fixture(page);try{
  for(const name of ['Calendar','Timeline / Gantt']){
   await page.goto(f.url+'/views/issues/new');await page.getByLabel('View title',{exact:true}).fill('New '+name);
   await layout(page,name);await page.getByLabel('Go to date',{exact:true}).fill('2026-09-12');
   if(name==='Calendar')await page.getByRole('combobox',{name:'Calendar range',exact:true}).selectOption('week');
   else await page.getByRole('combobox',{name:'Issue timeline scale',exact:true}).selectOption('quarter');
   await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page).toHaveURL(/\/view\//);
   const saved=f.app.repo.all('views',f.state.workspaceId).find(v=>v.name==='New '+name)!;
   expect(saved.layout).toBe(name==='Calendar'?'Calendar':'Timeline');expect(saved.display.scheduleAnchor).toBe('2026-09-12');
   const context=await browser.newContext({storageState:await page.context().storageState()}),fresh=await context.newPage();
   await fresh.goto(f.url+'/view/'+saved.id);await expect(fresh.getByRole('region',{name:name+' view',exact:true})).toBeVisible();
   await expect(fresh.getByRole('combobox',{name:name==='Calendar'?'Calendar range':'Issue timeline scale',exact:true})).toHaveValue(name==='Calendar'?'week':'quarter');await context.close();
  }
 }finally{await page.close();await f.app.close();}
});

test('calendar drag, date editing and layout settings persist across a fresh client',async({page,browser},info)=>{
 const f=await fixture(page);try{
  await page.getByRole('button',{name:'Schedule Prepare launch',exact:true}).dragTo(page.locator('.schedule-day[data-date="2026-09-17"]'));
  await expect.poll(()=>f.current().dueDate).toBe('2026-09-17');expect(f.current().startDate).toBe('2026-09-14');
  await expect(page).toHaveURL(f.route);
  await page.getByRole('button',{name:'Schedule Plan follow-up',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Schedule Plan follow-up',exact:true});
  await dialog.getByLabel('Start date',{exact:true}).fill('2026-09-20');await dialog.getByLabel('Due date',{exact:true}).fill('2026-09-19');await dialog.getByRole('button',{name:'Save dates'}).click();
  await expect(dialog.getByRole('alert')).toContainText('on or after');
  await dialog.getByLabel('Due date',{exact:true}).fill('2026-09-22');await dialog.getByRole('button',{name:'Save dates'}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('combobox',{name:'Calendar range'}).selectOption('week');await page.getByRole('combobox',{name:'Calendar date field'}).selectOption('startDate');
  await page.getByRole('button',{name:'Save view settings',exact:true}).click();
  await expect.poll(()=>f.app.repo.get(f.actor,'views',f.view.id).display.calendarMode).toBe('week');
  await page.screenshot({path:info.outputPath('calendar-week.png')});
  const context=await browser.newContext({storageState:await page.context().storageState()}),fresh=await context.newPage();
  await fresh.goto(f.route);await expect(fresh.getByRole('combobox',{name:'Calendar range'})).toHaveValue('week');await expect(fresh.getByRole('combobox',{name:'Calendar date field'})).toHaveValue('startDate');await context.close();
  await layout(page,'Timeline / Gantt');await page.getByRole('button',{name:'Save view settings',exact:true}).click();await expect.poll(()=>f.app.repo.get(f.actor,'views',f.view.id).layout).toBe('Timeline');await page.reload();await expect(page.getByRole('region',{name:'Timeline / Gantt view'})).toBeVisible();
  expect(f.app.repo.get(f.actor,'views',f.view.id).layout).toBe('Timeline');
 }finally{await page.close();await f.app.close();}
});

test('Gantt move, resize, cancellation, dependencies, and narrow layout',async({page},info)=>{
 const f=await fixture(page);try{
  await layout(page,'Timeline / Gantt');
  const move=page.getByRole('button',{name:'Move Prepare launch',exact:true});
  await move.focus();await page.keyboard.press('Alt+ArrowRight');await expect.poll(()=>f.current().startDate).toBe('2026-09-08');expect(f.current().dueDate).toBe('2026-09-11');
  const end=page.getByRole('button',{name:'Resize end of Prepare launch',exact:true});await end.focus();await page.keyboard.press('Alt+ArrowRight');await expect.poll(()=>f.current().dueDate).toBe('2026-09-12');
  const box=(await move.boundingBox())!;await page.mouse.move(box.x+15,box.y+12);await page.mouse.down();await page.mouse.move(box.x+87,box.y+12,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();expect(f.current().startDate).toBe('2026-09-08');
  await expect(page.locator('.schedule-dependencies>path')).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Dependencies',exact:true}).uncheck();await expect(page.locator('.schedule-dependencies>path')).toHaveCount(0);
  const second=(await move.boundingBox())!;await page.mouse.move(second.x+15,second.y+12);await page.mouse.down();await page.mouse.move(second.x+51,second.y+12,{steps:6});await page.mouse.up();await expect.poll(()=>f.current().startDate).toBe('2026-09-09');
  expect(f.current(f.next.id).startDate).toBe('2026-09-11');
  await page.screenshot({path:info.outputPath('issue-gantt.png')});
  await page.setViewportSize({width:760,height:700});await expect(move).toBeVisible();await page.getByRole('combobox',{name:'Issue timeline scale'}).selectOption('quarter');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:info.outputPath('issue-gantt-narrow.png')});
 }finally{await page.close();await f.app.close();}
});

test('project calendar is editable and dashboards are a first-class saved workspace destination',async({page},info)=>{
 const f=await fixture(page);try{
  const view=f.app.repo.create(f.actor,'views',{name:'Project dates',entityType:'projects',visibility:'workspace',layout:'Calendar',display:{scheduleAnchor:'2026-09-12'}});
  await page.goto(f.url+'/view/'+view.id);await expect(page.getByRole('region',{name:'Calendar view',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Schedule Example project',exact:true}).dragTo(page.locator('.schedule-day[data-date="2026-09-22"]'));
  await expect.poll(()=>f.app.repo.get(f.actor,'projects',f.project.id).targetDate).toBe('2026-09-22');expect(f.app.repo.get(f.actor,'projects',f.project.id).startDate).toBe('2026-09-03');
  await page.locator('[data-sidebar-path="/dashboards"]').click();
  await page.getByRole('button',{name:'New dashboard',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'New dashboard',exact:true});await dialog.getByLabel('Name',{exact:true}).fill('Work overview');await dialog.getByRole('button',{name:'Create dashboard',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Effort by customer',exact:true})).toBeVisible();
  const dashboard=f.app.repo.all('dashboards',f.state.workspaceId).find(d=>d.name==='Work overview')!;expect(dashboard.widgets).toHaveLength(5);
  await page.reload();await expect(page.getByRole('heading',{name:'Effort by customer',exact:true})).toBeVisible();
  await expect(page.getByText('Example customer',{exact:true}).first()).toBeVisible();
  await page.screenshot({path:info.outputPath('dashboard-overview.png')});
 }finally{await page.close();await f.app.close();}
});

test('schedule rejects invalid date ranges server-side and leaves the issue unchanged',async({page})=>{
 const f=await fixture(page);try{
  const before=f.current();const response=await page.request.patch(f.url+'/api/v1/issues/'+f.issue.id,{data:{startDate:'2026-10-01'}});expect(response.status()).toBe(422);expect(f.current()).toEqual(before);
 }finally{await page.close();await f.app.close();}
});

test('project timeline settings save into a named view and load without local preferences',async({page,browser})=>{
 const f=await fixture(page);try{
  const view=f.app.repo.create(f.actor,'views',{name:'Project roadmap',entityType:'projects',projectPage:true,projectPageScope:'workspace',layout:'Timeline',visibility:'workspace'});
  await page.goto(f.url+'/view/'+view.id);await page.getByRole('combobox',{name:'Timeline scale',exact:true}).selectOption('quarter');
  await page.getByRole('button',{name:'Project display options',exact:true}).click();await page.getByRole('button',{name:'Save changes to view',exact:true}).click();
  await expect.poll(()=>f.app.repo.get(f.actor,'views',view.id).display?.projectTimeline?.scale).toBe('quarter');
  const context=await browser.newContext({storageState:await page.context().storageState()}),fresh=await context.newPage();await fresh.goto(f.url+'/view/'+view.id);await expect(fresh.getByRole('combobox',{name:'Timeline scale',exact:true})).toHaveValue('quarter');await context.close();
 }finally{await page.close();await f.app.close();}
});

test('calendar edits queue offline and rejected saves show an error without navigation',async({page})=>{
 const f=await fixture(page);try{
  await page.context().setOffline(true);
  await page.getByRole('button',{name:'Schedule Prepare launch',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Schedule Prepare launch',exact:true});await dialog.getByLabel('Due date',{exact:true}).fill('2026-09-18');await dialog.getByRole('button',{name:'Save dates',exact:true}).click();await expect(dialog).toHaveCount(0);expect(f.current().dueDate).toBe('2026-09-10');
  await page.context().setOffline(false);await expect.poll(()=>f.current().dueDate).toBe('2026-09-18');
  await page.route('**/api/v1/batch',route=>route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:{message:'Schedule test rejection',code:'VALIDATION_ERROR'}})}));
  // The normal durable mutation failure UI must stay reachable after scheduling.
  await page.getByRole('button',{name:'Schedule Prepare launch',exact:true}).click();dialog=page.getByRole('dialog',{name:'Schedule Prepare launch',exact:true});await dialog.getByLabel('Due date',{exact:true}).fill('2026-09-19');await dialog.getByRole('button',{name:'Save dates',exact:true}).click();
  await expect(page.getByText(/Schedule test rejection/).first()).toBeVisible();await expect(page).toHaveURL(f.route);
 }finally{await page.context().setOffline(false);await page.close();await f.app.close();}
});
