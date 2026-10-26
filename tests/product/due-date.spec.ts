import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test.use({timezoneId:'America/Los_Angeles'});
test('due-date indicators agree across list and board and update at local midnight',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.clock.install({time:new Date('2026-09-07T06:59:30Z')});
 await page.request.post(url+'/auth/setup',{data:{name:'Due dates',email:'due-dates@example.test',password:'due-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 for(const [title,dueDate] of [['Today','2026-09-06'],['Tomorrow','2026-09-07'],['Next week','2026-09-13'],['Later','2026-09-14']])expect((await page.request.post(url+'/api/v1/issues',{data:{title,teamId:team.id,dueDate}})).ok()).toBeTruthy();
 await page.goto(url+'/team/'+team.id+'/all');await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('button',{name:'Display dueDate',exact:true}).click();await page.keyboard.press('Escape');
 const badge=(title:string)=>page.locator('.issue-row').filter({has:page.locator('.issue-row-title',{hasText:new RegExp('^'+title+'$')})}).locator('.issue-due-date');
 await expect(badge('Today')).toHaveAttribute('data-due-tone','urgent');await expect(badge('Tomorrow')).toHaveAttribute('data-due-tone','soon');await expect(badge('Next week')).toHaveAttribute('data-due-tone','soon');await expect(badge('Later')).toHaveAttribute('data-due-tone','later');await expect(badge('Today')).toContainText('Sep 6');await expect(badge('Tomorrow')).toHaveAttribute('data-tooltip',/Due in 1 day/);
 await badge('Tomorrow').hover();await expect(page.getByRole('tooltip')).toContainText('Due in 1 day');
 await page.clock.runFor(31000);await expect(badge('Tomorrow')).toHaveAttribute('data-due-tone','urgent');await expect(badge('Today')).toHaveAttribute('data-tooltip',/1 day overdue/);await expect(badge('Later')).toHaveAttribute('data-due-tone','soon');
 await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('.board-card .issue-due-date')).toHaveCount(4);await expect(page.locator('.board-card .issue-due-date[data-due-tone="urgent"]')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('due-date ordering keeps undated issues last in both directions and after reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Date ordering',email:'date-ordering@example.test',password:'due-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 for(const [title,dueDate] of [['No due date',null],['Later due','2026-12-31'],['Sooner due','2026-01-01']])expect((await page.request.post(url+'/api/v1/issues',{data:{title,teamId:team.id,dueDate}})).ok()).toBeTruthy();
 await page.goto(url+'/team/'+team.id+'/all');await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Ordering',{exact:true}).selectOption('dueDate');await expect(page.getByLabel('Direction',{exact:true})).toHaveAttribute('title',/^Ascending/);await page.keyboard.press('Escape');
 await expect(page.locator('.issue-row-title')).toHaveText(['Sooner due','Later due','No due date']);await page.reload();await expect(page.locator('.issue-row-title')).toHaveText(['Sooner due','Later due','No due date']);
 await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Direction',{exact:true}).click();await expect(page.getByLabel('Direction',{exact:true})).toHaveAttribute('title',/^Descending/);await page.keyboard.press('Escape');await expect(page.locator('.issue-row-title')).toHaveText(['Later due','Sooner due','No due date']);
 }finally{await page.close();await app.close()}
});

test('due-date keyboard entry and creation preview preserve the selected local calendar date',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.clock.install({time:new Date('2026-09-07T06:00:00Z')});
 await page.request.post(url+'/auth/setup',{data:{name:'Date entry',email:'date-entry@example.test',password:'due-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 await page.goto(url+'/team/'+team.id+'/all');await page.getByRole('button',{name:'Create new issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).fill('Local due date');
 await page.locator('.issue-composer').getByRole('button',{name:'More actions',exact:true}).click();
 await page.locator('.composer-settings-menu').getByRole('menuitemcheckbox',{name:'Due date',exact:true}).click();await page.keyboard.press('Escape');
 await page.locator('.issue-composer').getByRole('button',{name:'Set due date',exact:true}).click();
 const date=page.getByRole('searchbox',{name:'Due date',exact:true});await date.fill('tomorrow');await date.press('Enter');
 const preview=page.locator('.composer-properties time');await expect(preview).toHaveAttribute('datetime','2026-09-07');await expect(preview).toHaveText('9/7/2026');
 await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();return s.issues.find((i:any)=>i.title==='Local due date')?.dueDate}).toBe('2026-09-07');
 const saved=await(await page.request.get(url+'/api/v1/state')).json(),issue=saved.issues.find((i:any)=>i.title==='Local due date');await page.goto(url+'/issues/'+issue.id);await expect(page.getByRole('textbox',{name:'Date',exact:true})).toHaveValue('2026-09-07');
 }finally{await page.close();await app.close()}
});
