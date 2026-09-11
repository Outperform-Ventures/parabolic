import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
import {selectedIssueListUrl} from '../../src/client/selected-issue-list';

test('one-off issue list links preserve exact membership across reload and never grant private issue access',async({page,browser})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),other=await browser.newContext(),member=await other.newPage();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'list-owner@example.test',name:'Owner',password:'owner-strong-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const invitation=await create('invitations',{email:'list-reader@example.test'});
  expect((await member.request.post(url+'/auth/join',{data:{token:invitation.token,name:'Reader',password:'reader-strong-password'}})).ok()).toBeTruthy();
  const first=await create('issues',{teamId:team.id,title:'Selected public issue'}),archived=await create('issues',{teamId:team.id,title:'Selected archived issue'}),unrelated=await create('issues',{teamId:team.id,title:'Unselected issue'});
  expect((await page.request.patch(url+'/api/v1/issues/'+archived.id,{data:{archivedAt:new Date().toISOString()}})).ok()).toBeTruthy();
  const privateTeam=await create('teams',{name:'Private selection',key:'PRV',visibility:'private'}),hidden=await create('issues',{teamId:privateTeam.id,title:'Confidential selected issue'});
  const link=selectedIssueListUrl(url,[first,archived,hidden]);
  await page.goto(link);
  for(const item of [first,archived,hidden])await expect(page.locator('.issue-row[data-issue-id="'+item.id+'"]')).toBeVisible();
  await expect(page.locator('.issue-row[data-issue-id="'+unrelated.id+'"]')).toHaveCount(0);
  await page.reload();await expect(page.locator('.issue-row[data-issue-id="'+archived.id+'"]')).toBeVisible();
  await member.goto(link);
  for(const item of [first,archived])await expect(member.locator('.issue-row[data-issue-id="'+item.id+'"]')).toBeVisible();
  await expect(member.locator('.issue-row[data-issue-id="'+hidden.id+'"]')).toHaveCount(0);
  await expect(member.getByText(hidden.title,{exact:true})).toHaveCount(0);
  await expect(member.locator('.issue-row[data-issue-id="'+unrelated.id+'"]')).toHaveCount(0);
  await member.goto(url+'/issues/'+hidden.identifier+',UNKNOWN-999');
  await expect(member.locator('.issue-view')).toBeVisible();
  await expect(member.locator('.issue-row')).toHaveCount(0);
 }finally{await other.close();await app.close();}
});
