import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';
import {resolve} from 'node:path';

test('Created by filters preserve authorship through edits, API queries and saved views',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try {
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'creator-owner@example.test',password:'owner-password',workspaceName:'Creator filters'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const owner:Actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const invitation=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'creator-member@example.test',role:'member'}})).json();
  const joined=await(await fetch(url+'/auth/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invitation.token,name:'Second author',password:'member-password'})})).json();
  const member:Actor={...owner,userId:joined.user.id,role:'member',scopes:['read','write']};
  const statusId=state.statuses.find((status:any)=>status.teamId===team.id && status.type==='unstarted').id;
  const first=app.repo.create(owner,'issues',{title:'First author issue',teamId:team.id,statusId});
  const second=app.repo.create(member,'issues',{title:'Second author issue',teamId:team.id,statusId});
  app.repo.update(owner,'issues',second.id,{description:'Edited by owner',assigneeId:owner.userId,creatorId:owner.userId});
  await page.goto(url+'/team/'+team.id+'/all');
  await expect(page.locator('.issue-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await page.getByRole('button',{name:'Add filter',exact:true}).click();
  await expect(page.locator('.filter-condition select').nth(0).locator('option[value="creatorId"]')).toHaveCount(1);
  await page.locator('.filter-condition select').nth(0).selectOption('creatorId');
  await page.locator('.filter-condition select').nth(2).selectOption(member.userId);
  await expect(page.locator('.issue-row')).toHaveCount(1);
  await expect(page.locator('.issue-row')).toContainText(second.title);
  const filters={match:'all',conditions:[{field:'creatorId',operator:'eq',value:member.userId}]};
  const result=await(await page.request.get(url+'/api/v1/issues?filter='+encodeURIComponent(JSON.stringify(filters)))).json();
  expect(result.nodes.map((issue:any)=>issue.id)).toEqual([second.id]);
  const view=await(await page.request.post(url+'/api/v1/views',{data:{name:'Second author work',entityType:'issues',filters}})).json();
  await page.goto(url+'/view/'+view.id);await page.reload();
  await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(second.title);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await page.locator('.filter-condition select').nth(1).selectOption('neq');
  await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(first.title);
 } finally {await page.close();await app.close()}
});

test('creator filters include pending offline creations after reload and reconnect',async({page,context,browserName})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 let disconnected=false;const listeners=app.server.listeners('request');
 if(browserName==='webkit'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(disconnected){request.socket.destroy();return;}for(const listener of listeners)listener.call(app.server,request,response)})}
 const offline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections()}else await context.setOffline(value)};
 try {
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'offline-creator@example.test',password:'owner-password'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),team=initial.teams[0];
  const actor:Actor={userId:initial.user.id,workspaceId:initial.workspaceId,role:'owner',scopes:['admin']};
  const view=app.repo.create(actor,'views',{name:'Created by me',entityType:'issues',filters:{match:'all',conditions:[{field:'creatorId',operator:'eq',value:actor.userId}]}});
  await page.goto(url+'/view/'+view.id);await expect(page.getByRole('button',{name:'New issue',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'New issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).fill('My offline creation');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await offline(true);
  await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('My offline creation');
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.issue-row')).toHaveCount(1);
  await offline(false);await expect.poll(async()=>(await state()).issues.find((issue:any)=>issue.title==='My offline creation')?.creatorId,{timeout:20000}).toBe(actor.userId);
  await page.reload();await expect(page.locator('.issue-row')).toHaveCount(1);
 } finally {await offline(false);await page.close();await app.close()}
});
