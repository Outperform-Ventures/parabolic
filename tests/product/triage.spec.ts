import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test.use({serviceWorkers:'block'});
test('triage deep links retain the requested issue through cached startup and delayed synchronization',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let release=()=>{};
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'triage-link@example.test',password:'owner-password'}});const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()},team=await create('teams',{name:'Delayed triage',key:'DLY',triageEnabled:true});
  await page.goto(url+'/team/'+team.id+'/triage');await expect(page.getByRole('heading',{name:'Triage is clear'})).toBeVisible();await expect(page.getByText('Loading workspace…',{exact:true})).toHaveCount(0);await page.goto('about:blank');
  const state=await(await page.request.get(url+'/api/v1/state')).json(),status=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='triage'),first=await create('issues',{teamId:team.id,statusId:status.id,title:'Requested older issue'}),second=await create('issues',{teamId:team.id,statusId:status.id,title:'Newer queue item'});
  const gate=new Promise<void>(resolve=>release=resolve);await page.route(url+'/auth/status',async route=>{await gate;await route.continue()});await page.goto(url+'/team/'+team.id+'/triage?issue='+first.id);await expect(page.getByRole('heading',{name:'Triage is clear'})).toBeVisible();release();const queue=page.getByRole('listbox',{name:'Triage issues'});await expect(queue.getByRole('option',{name:first.title,exact:true})).toHaveAttribute('aria-selected','true');await expect(queue.getByRole('option',{name:second.title,exact:true})).toHaveAttribute('aria-selected','false');
  await queue.getByRole('option',{name:second.title,exact:true}).click();await expect(page).toHaveURL(new RegExp('issue='+second.id));await expect(queue.getByRole('option',{name:second.title,exact:true})).toHaveAttribute('aria-selected','true');
  await page.request.post(url+'/api/v1/issues/'+second.id+'/triage',{data:{action:'accept'}});await expect(queue.getByRole('option',{name:second.title,exact:true})).toHaveCount(0);await expect(page).toHaveURL(new RegExp('issue='+first.id));await expect(queue.getByRole('option',{name:first.title,exact:true})).toHaveAttribute('aria-selected','true');
  await page.request.post(url+'/api/v1/issues/'+first.id+'/triage',{data:{action:'decline'}});await expect(page.getByRole('heading',{name:'Triage is clear'})).toBeVisible();await expect(page).not.toHaveURL(/(?:\?|&)issue=/);
 }finally{release();await page.close();await app.close()}
});
