import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('P1 navigation: joined teams and Triage visibility, command quick-open and selected issue property changes',async({page})=>{
 test.setTimeout(90000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Navigation owner',email:'navigation-push@example.test',password:'navigation-push-password'}});
  const initial=await(await page.request.get(url+'/api/v1/state')).json(),team=initial.teams[0];
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{triageEnabled:true}});
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Navigation command issue'}})).json();
  await page.goto(url+'/team/'+team.id+'/all');await expect(page.getByTestId('issue-row')).toHaveCount(1);
  const heading=page.locator('.sidebar-team').filter({hasText:team.name}).getByRole('button',{name:'Toggle '+team.name+' navigation',exact:true});
  if(await heading.getAttribute('aria-expanded')==='false')await heading.click();
  await expect(page.locator('.team-links').getByRole('link',{name:'Triage',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open '+team.name+' home',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/team/'+team.id+'/overview$'));
  await expect(heading).toHaveAttribute('aria-expanded','true');
  await heading.click();await expect(heading).toHaveAttribute('aria-expanded','false');
  await page.reload();await expect(heading).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(({userId,workspaceId})=>localStorage.getItem('collapsed-teams:'+userId+':'+workspaceId),{userId:initial.user.id,workspaceId:initial.workspaceId})).toContain(team.id);
  await heading.click();await page.goto(url+'/team/'+team.id+'/all');
  await page.locator('.page-header h1').click();await page.keyboard.press('j');
  const command=async(label:string)=>{await page.keyboard.press('Meta+k');await page.getByRole('textbox',{name:'Command menu',exact:true}).fill(label);await page.getByRole('option',{name:new RegExp('^'+label)}).first().click();};
  await command('Change priority');await expect(page.getByRole('dialog')).toContainText('Change Priority');await page.getByRole('dialog').getByRole('button',{name:'High',exact:true}).click();
  await expect.poll(async()=>{const state=await(await page.request.get(url+'/api/v1/state')).json();return state.issues.find((row:any)=>row.id===issue.id).priority;}).toBe(2);
  await command('Find in view');await expect(page.locator('.view-search')).toBeVisible();await page.keyboard.press('Escape');
  await command('Open issue');await expect(page.getByRole('textbox',{name:'Open issue',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Open issue',exact:true}).fill('Navigation command issue');await page.getByRole('option').filter({hasText:'Navigation command issue'}).click();await expect(page).toHaveURL(new RegExp('/issues/'+issue.id+'$'));
 }finally{await app.close();}
});
