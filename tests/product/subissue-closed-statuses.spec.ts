import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';
test('last child closure in either Done/Canceled order closes the visible parent and preserves child statuses',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Closure',email:'closure-ui@example.test',password:'closure-ui-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],status=(type:string)=>state.statuses.find((s:any)=>s.teamId===team.id&&s.type===type);await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{autoCloseParentIssues:true,autoCloseSubIssues:true}});
  const create=async(title:string,parentId?:string)=>await(await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title,parentId,statusId:status('unstarted').id}})).json();
  for(const [first,last] of [['completed','canceled'],['canceled','completed']]){
   const parent=await create('Parent '+first+' '+last),a=await create('First child',parent.id),b=await create('Last child',parent.id);await page.request.patch(url+'/api/v1/issues/'+a.id,{data:{statusId:status(first).id}});
   await page.goto(url+'/issues/'+b.id);await page.getByRole('button',{name:'Change status',exact:true}).first().click();await page.locator('.property-menu').getByRole('button',{name:status(last).name,exact:true}).click();
   await expect.poll(async()=>{const value=await(await page.request.get(url+'/api/v1/issues/'+parent.id)).json();return value.statusId}).toBe(status('completed').id);await page.goto(url+'/issues/'+parent.id);await expect(page.locator('.issue-properties-panel').getByRole('button',{name:'Change status',exact:true})).toContainText(status('completed').name);
   const firstChild=await(await page.request.get(url+'/api/v1/issues/'+a.id)).json();expect(firstChild.statusId).toBe(status(first).id);
  }
 }finally{await page.close();await app.close()}
});
