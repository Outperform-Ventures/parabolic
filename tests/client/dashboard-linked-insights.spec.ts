import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('view insights can be added to dashboards and follow source filters while inaccessible sources fail closed',async({page,browser})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),other=await browser.newContext(),reader=await other.newPage();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'linked-owner@example.test',name:'Owner',password:'linked-owner-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const initial=await(await page.request.get(url+'/api/v1/state')).json(),team=initial.teams[0];
  const invite=await create('invitations',{email:'linked-reader@example.test'});await reader.request.post(url+'/auth/join',{data:{token:invite.token,name:'Reader',password:'linked-reader-password'}});
  await create('issues',{teamId:team.id,title:'First high',priority:2});await create('issues',{teamId:team.id,title:'Second low',priority:4});
  const view=await create('views',{name:'Linked source',entityType:'issues',visibility:'workspace',filters:{match:'all',conditions:[]}}),dashboard=await create('dashboards',{name:'Shared dashboard',visibility:'workspace',widgets:[]});
  await page.goto(url+'/view/'+view.id);await page.getByRole('button',{name:'Toggle insights',exact:true}).click();
  const panel=page.getByRole('complementary',{name:'View insights',exact:true});await panel.getByRole('button',{name:'Add to dashboard',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add to dashboard',exact:true});await dialog.getByLabel('Dashboard',{exact:true}).selectOption(dashboard.id);await dialog.getByRole('button',{name:'Add insight',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.goto(url+'/dashboards/'+dashboard.id);await expect(page.getByText('2 matching issues',{exact:true})).toBeVisible();
  expect((await page.request.patch(url+'/api/v1/views/'+view.id,{data:{filters:{match:'all',conditions:[{field:'priority',operator:'eq',value:2}]}}})).ok()).toBeTruthy();
  await expect(page.getByText('1 matching issues',{exact:true})).toBeVisible();
  await reader.goto(url+'/dashboards/'+dashboard.id);await expect(reader.getByText('1 matching issues',{exact:true})).toBeVisible();
  expect((await page.request.patch(url+'/api/v1/views/'+view.id,{data:{visibility:'private'}})).ok()).toBeTruthy();
  await reader.reload();await expect(reader.getByText('Source insight is unavailable or you do not have access.',{exact:true})).toBeVisible();
  await expect(reader.locator('.feature-analysis-total')).toHaveCount(0);
 }finally{await other.close();await app.close()}
});
