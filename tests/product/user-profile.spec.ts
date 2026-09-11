import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('person profile scopes Assigned and Created, preserves issue context and opens from assignee',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Profile Owner',email:'profile@example.test',password:'profile-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0],user=state.user;
  const issue=await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Assigned to owner',assigneeId:user.id}}).then(r=>r.json());
  await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Created but unassigned'}});
  await page.goto(url+'/issues/'+issue.id);
  const event=page.locator('.activity-event').first();await expect(event).toBeVisible();
  await expect(event.locator('.activity-event-avatar a')).toHaveAttribute('href','/profiles/'+user.id);
  const permalink=event.locator('.activity-event-permalink');await expect(permalink).toHaveAttribute('title',/.+/);
  const anchor=await event.getAttribute('id');await permalink.click();await expect(page).toHaveURL(url+'/issues/'+issue.id+'#'+anchor);
  await page.reload();await expect(page.locator('[id="'+anchor+'"]')).toBeVisible();
  await page.locator('.activity-event-copy strong a').first().click();await expect(page).toHaveURL(url+'/profiles/'+user.id);
  await page.goto(url+'/issues/'+issue.id);await page.locator('.issue-properties-panel [data-property=assigneeId]').hover();
  await page.getByRole('link',{name:'Go to user',exact:true}).click();await expect(page).toHaveURL(url+'/profiles/'+user.id);
  const rows=page.locator('[data-testid=issue-row]');await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Open user',exact:true})).toContainText('Profile Owner');
  await expect(page.locator('.page-tabs')).toHaveText('AssignedCreated');
  await page.locator('.page-tabs').getByRole('button',{name:'Created',exact:true}).click();await expect(rows).toHaveCount(2);
  await rows.first().focus();await page.keyboard.press('Enter');await expect(page.locator('.issue-context-link')).toHaveAttribute('href','/profiles/'+user.id+'/created');
  await expect(page.locator('.issue-context-link')).toHaveText('Profile Owner');await page.locator('.issue-context-link').click();await expect(rows).toHaveCount(2);
  await page.getByRole('button',{name:'Open user',exact:true}).click();await page.getByRole('textbox',{name:'Open user…',exact:true}).fill('Profile Owner');await page.getByRole('menuitem',{name:'Profile Owner',exact:true}).click();await expect(rows).toHaveCount(1);
  await page.goto(url+'/profiles/nonexistent');await expect(rows).toHaveCount(0);
  await page.goto(url+'/projects');await page.keyboard.press('o');await page.keyboard.press('u');
  const picker=page.getByRole('dialog');await expect(picker).toBeVisible();await picker.getByRole('button',{name:'Profile Owner',exact:true}).click();
  await expect(page).toHaveURL(url+'/profiles/'+user.id);await expect(page).toHaveTitle(/Profile Owner.*Assigned/);
  await page.keyboard.press('Meta+k');await page.getByRole('textbox',{name:'Command menu',exact:true}).fill('Open user');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toContainText('Open user');await page.keyboard.press('Escape');
 }finally{await page.close();await app.close()}
});
