import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('selected issue keyboard reorder and context mutations share one undo action',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Bulk owner',email:'bulk-owner@example.test',password:'Bulk-owner-password'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state();
  const create=async(kind:string,data:any)=>{const response=await page.request.post(`${url}/api/v1/${kind}`,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const team=await create('teams',{name:'Selection team',key:'SEL'}),other=await create('teams',{name:'Destination team',key:'DST'}),issues=[];
  for(let n=0;n<4;n++)issues.push(await create('issues',{teamId:team.id,title:'Bulk item '+n,sortOrder:n}));
  await page.addInitScript(({workspace,user,team})=>localStorage.setItem(`display:${workspace}:${user}:${team}:all`,JSON.stringify({groupBy:'none',orderBy:'sortOrder',layout:'list',showCompleted:true})),{workspace:initial.workspaceId,user:initial.user.id,team:team.id});
  await page.goto(`${url}/team/${team.id}/all`);
  for(const issue of issues.slice(1,3))await page.getByRole('button',{name:`Select ${issue.identifier}`,exact:true}).click();
  await page.locator(`[data-testid="issue-row"][data-issue-id="${issues[1].id}"]`).focus();await page.keyboard.press('Alt+ArrowDown');
  const sorted=async()=>(await state()).issues.filter((i:any)=>i.teamId===team.id).sort((a:any,b:any)=>a.sortOrder-b.sortOrder).map((i:any)=>i.id);
  await expect.poll(sorted).toEqual([issues[0].id,issues[3].id,issues[1].id,issues[2].id]);
  const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');await page.keyboard.press(`${mod}+z`);await expect.poll(sorted).toEqual(issues.map(i=>i.id));
  await page.locator(`[data-testid="issue-row"][data-issue-id="${issues[1].id}"]`).click({button:'right'});
  await page.getByRole('menuitem',{name:'Move to team…',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Update 2 issues',exact:true});await dialog.getByRole('button',{name:'Change team',exact:true}).click();
  await page.locator('.property-menu').getByRole('button',{name:'Destination team',exact:true}).click();
  await expect.poll(async()=>(await state()).issues.filter((i:any)=>i.teamId===other.id).map((i:any)=>i.id).sort()).toEqual(issues.slice(1,3).map(i=>i.id).sort());
  await page.keyboard.press(`${mod}+z`);await expect.poll(sorted).toEqual(issues.map(i=>i.id));
 }finally{await page.close();await app.close()}
});

test('old issue links resolve after moves and description history restores rich content with undo',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'History owner',email:'history-owner@example.test',password:'History-owner-password'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:initial.teams[0].id,title:'History recovery',description:'<p><strong>Original formatted body</strong></p>'}})).json();
  const team=await(await page.request.post(url+'/api/v1/teams',{data:{name:'History destination',key:'HIST'}})).json();
  await page.request.patch(`${url}/api/v1/issues/${issue.id}`,{data:{teamId:team.id,description:'<p>Replacement body</p>'}});
  await page.goto(`${url}/issues/${issue.identifier}`);await expect(page).toHaveURL(`${url}/issues/${issue.id}`);
  await page.getByRole('button',{name:'Issue options',exact:true}).first().click();await page.getByRole('menuitem',{name:'Show description history',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/^Restore version for /});await expect(dialog.locator('strong')).toContainText('Original formatted body');
  await dialog.getByRole('button',{name:'Restore version',exact:true}).first().click();
  const body=async()=>(await state()).issues.find((i:any)=>i.id===issue.id).description;
  await expect.poll(body).toContain('<strong>Original formatted body</strong>');
  const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());await page.keyboard.press(`${mod}+z`);await expect.poll(body).toContain('Replacement body');
 }finally{await page.close();await app.close()}
});
