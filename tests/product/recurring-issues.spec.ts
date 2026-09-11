import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('recurrence conversion, team settings editing, cancellation and creation persist',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'recurring-ui@example.test',password:'test-owner-password',workspaceName:'Recurring'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),team=initial.teams[0];
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{timezone:'America/New_York'}});
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Recurring UI task',teamId:team.id}})).json();
  await page.goto(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Issue options',exact:true}).click();await page.getByRole('menuitem',{name:'Convert into recurring issue',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Set recurrence'})).toBeEnabled();await expect(dialog.getByLabel('Repeat interval').locator('option')).toHaveCount(12);await dialog.getByLabel('First due date',{exact:true}).fill('2027-01-31');await dialog.getByLabel('Repeat',{exact:true}).selectOption('monthly');await dialog.getByRole('button',{name:'Set recurrence'}).click();
  await expect.poll(async()=>(await state()).issues.find((i:any)=>i.id===issue.id)?.nextRunAt).toBe('2027-02-01T05:01:00.000Z');
  app.scheduler.tick(new Date('2027-02-01T05:01:00.000Z'));
  await page.goto(url+'/settings/team-'+team.id+'?section=Recurring%20issues');await expect(page.getByRole('heading',{name:'Recurring issues',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:new RegExp('Recurring UI task')})).toBeVisible();
  await page.getByRole('button',{name:'Edit recurrence',exact:true}).click();await expect(dialog.getByLabel('Next due date',{exact:true})).toHaveValue('02/28/2027');await dialog.getByLabel('Repeat',{exact:true}).selectOption('yearly');await dialog.getByLabel('Repeat interval').selectOption('2');await dialog.getByRole('button',{name:'Set recurrence'}).click();await expect.poll(async()=>(await state()).issues.find((i:any)=>i.id===issue.id)?.recurrence.interval).toBe(2);expect((await state()).issues.find((i:any)=>i.id===issue.id).dueDate).toBe('2027-01-31');expect((await state()).issues.find((i:any)=>i.id===issue.id).recurrenceDueDate).toBe('2027-02-28');
  await page.reload();await page.getByRole('button',{name:'Edit recurrence',exact:true}).click();await expect(dialog.getByLabel('Repeat interval')).toHaveValue('2');await expect(dialog.getByLabel('Repeat',{exact:true})).toHaveValue('yearly');await dialog.getByRole('button',{name:'Stop repeating'}).click();await expect(page.getByText('No recurring issues',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await state()).issues.find((i:any)=>i.id===issue.id)?.nextRunAt).toBe(null);
  await page.goto(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Issue options',exact:true}).waitFor();await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());const mod=process.platform==='darwin'?'Meta':'Control';await page.keyboard.press(mod+'+k');await page.getByRole('textbox',{name:'Command menu',exact:true}).fill('Convert into recurring issue');await page.getByRole('option',{name:'Convert into recurring issue',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Make recurring',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goto(url+'/settings/team-'+team.id+'?section=Recurring%20issues');
  await page.getByRole('button',{name:'Create recurring issue',exact:true}).click();await dialog.filter({has:page.getByRole('heading',{name:'Make recurring',exact:true})}).getByLabel('First due date',{exact:true}).fill('2027-03-10');await page.getByRole('button',{name:'Set recurrence',exact:true}).click();
  await page.getByRole('textbox',{name:'Issue title',exact:true}).fill('Created from recurring settings');await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect.poll(async()=>(await state()).issues.find((i:any)=>i.title==='Created from recurring settings')?.dueDate).toBe('2027-03-10');
 }finally{await page.close();await app.close()}
});

test('recurrence filters agree with API and persist in saved views',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'recurring-filter@example.test',password:'test-owner-password',workspaceName:'Recurring filters'}});
  const initial=await(await page.request.get(url+'/api/v1/state')).json(),team=initial.teams[0];
  const create=async(kind:string,data:any)=>await(await page.request.post(url+'/api/v1/'+kind,{data})).json();
  const series=await create('issues',{title:'Recurring review',teamId:team.id,dueDate:'2027-09-20',recurrence:{frequency:'weekly'}});
  const ordinary=await create('issues',{title:'One-time review',teamId:team.id});
  await page.goto(url+'/team/'+team.id+'/all');await expect(page.locator('.issue-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.locator('.filter-condition select').nth(0).selectOption('recurrence');
  await expect(page.locator('.filter-condition select').nth(1)).toHaveValue('notEmpty');await expect(page.locator('.filter-condition select')).toHaveCount(2);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(series.title);
  const filter={conditions:[{field:'recurrence',operator:'notEmpty',value:''}],match:'all'};
  const response=await page.request.get(url+'/api/v1/issues?filter='+encodeURIComponent(JSON.stringify(filter)));expect(response.ok()).toBeTruthy();expect((await response.json()).nodes.map((i:any)=>i.id)).toEqual([series.id]);
  const view=await create('views',{name:'Repeating work',entityType:'issues',filters:filter});await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(series.title);
  await page.reload();await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(series.title);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.locator('.filter-condition select').nth(1).selectOption('empty');await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(ordinary.title);
  await page.locator('.filter-condition select').nth(0).selectOption('priority');await expect(page.locator('.filter-condition select').nth(1)).toHaveValue('eq');await expect(page.locator('.filter-condition select')).toHaveCount(3);
 }finally{await page.close();await app.close()}
});

 test('recurrence dates accept natural language, reject new past dates and preserve legacy no-op schedules',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'recurring-dates@example.test',password:'test-owner-password',workspaceName:'Recurring dates'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),team=initial.teams[0];
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Legacy cadence',teamId:team.id,dueDate:'2020-01-01',recurrence:{frequency:'yearly',interval:24}}})).json();
  await page.goto(url+'/settings/team-'+team.id+'?section=Recurring%20issues');await page.getByRole('button',{name:'Edit recurrence',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Edit recurrence'});await expect(dialog.getByLabel('Next due date')).toHaveValue('01/01/2020');await expect(dialog.getByLabel('Repeat interval')).toHaveValue('24');await dialog.getByRole('button',{name:'Set recurrence'}).click();
  await expect(dialog).toBeHidden();const unchanged=(await state()).issues.find((i:any)=>i.id===issue.id);expect(unchanged.recurrence.interval).toBe(24);expect(unchanged.nextRunAt).toBe(issue.nextRunAt);expect(unchanged.recurrenceDueDate).toBe(issue.recurrenceDueDate);
  await page.getByRole('button',{name:'Create recurring issue',exact:true}).click();const creation=page.getByRole('dialog',{name:'Make recurring'});const field=creation.getByLabel('First due date');
  const nextWeek=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+7);return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)});await expect(field).toHaveValue(nextWeek);await expect(field).toHaveCSS('width','104px');await creation.screenshot({path:'artifacts/verification/recurrence-controls-'+test.info().project.name+'.png'});
  await field.fill('2000-01-01');await creation.getByRole('button',{name:'Set recurrence'}).click();await expect(creation).toBeVisible();expect(await field.evaluate((el:HTMLInputElement)=>el.validity.valid)).toBe(false);
  await field.fill('tomorrow');await field.dispatchEvent('keydown',{key:'Enter',isComposing:true});await expect(field).toHaveValue('tomorrow');await field.dispatchEvent('keydown',{key:'ArrowDown',keyCode:229});await expect(page.getByRole('dialog',{name:'First due date picker'})).toHaveCount(0);await field.press('Enter');const tomorrow=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+1);return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)});await expect(field).toHaveValue(tomorrow);
  await field.click();const picker=page.getByRole('dialog',{name:'First due date picker'});await expect(picker.getByRole('button',{name:'Remove date'})).toHaveCount(0);await picker.getByLabel('Date expression').fill('next week');await picker.getByLabel('Date expression').dispatchEvent('keydown',{key:'Enter',isComposing:true});await expect(picker).toBeVisible();await picker.getByLabel('Date expression').dispatchEvent('keydown',{key:'Escape',isComposing:true});await expect(picker).toBeVisible();await page.keyboard.press('Escape');await creation.getByRole('button',{name:'Cancel',exact:true}).click();
 }finally{await page.close();await app.close()}
 });

test('recurrence compact dates preserve en-GB day/month order on blur and save',async({browser})=>{
 const context=await browser.newContext({locale:'en-GB'}),page=await context.newPage(),app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'recurring-locale@example.test',password:'test-owner-password',workspaceName:'Recurring locale'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),team=initial.teams[0];
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Locale cadence',teamId:team.id,dueDate:'2027-06-05',recurrence:{frequency:'weekly',interval:1}}})).json();
  await page.goto(url+'/settings/team-'+team.id+'?section=Recurring%20issues');await page.getByRole('button',{name:'Edit recurrence',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit recurrence'}),field=dialog.getByLabel('Next due date');
  await expect(field).toHaveValue('05/06/2027');await field.focus();await field.press('Tab');await expect(field).toHaveValue('05/06/2027');await dialog.getByRole('button',{name:'Set recurrence'}).click();await expect(dialog).toBeHidden();expect((await state()).issues.find((i:any)=>i.id===issue.id).dueDate).toBe('2027-06-05');
  await page.getByRole('button',{name:'Edit recurrence',exact:true}).click();await field.fill('06/07/2027');await field.press('Tab');await dialog.getByRole('button',{name:'Set recurrence'}).click();await expect(dialog).toBeHidden();expect((await state()).issues.find((i:any)=>i.id===issue.id).dueDate).toBe('2027-07-06');
 }finally{await context.close();await app.close()}
});
