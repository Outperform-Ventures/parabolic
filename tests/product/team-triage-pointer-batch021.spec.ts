import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test.use({serviceWorkers:'block',colorScheme:'dark'});

test('team triage queue rows expose hover feedback and select the clicked issue',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Triage pointer owner',email:'triage-pointer@example.test',password:'owner-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const team=await create('teams',{name:'Pointer triage',key:'PTR',triageEnabled:true}),state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),triage=state.statuses.find((status:any)=>status.teamId===team.id&&status.type==='triage');
  const selected=await create('issues',{teamId:team.id,statusId:triage.id,title:'Already selected request'}),target=await create('issues',{teamId:team.id,statusId:triage.id,title:'Hover and select request'});

  await page.goto(url+'/team/'+team.id+'/triage?issue='+selected.id);
  const queue=page.getByRole('listbox',{name:'Triage issues'}),row=queue.getByRole('option',{name:target.title,exact:true});
  await expect(queue.getByRole('option',{name:selected.title,exact:true})).toHaveAttribute('aria-selected','true');
  await expect(row).toHaveAttribute('aria-selected','false');

  const restingBackground=await row.evaluate(element=>getComputedStyle(element).backgroundColor);
  await row.hover();
  await expect.poll(()=>row.evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);

  await row.click();
  await expect(row).toHaveAttribute('aria-selected','true');
  await expect(page).toHaveURL(new RegExp('(?:\\?|&)issue='+target.id+'(?:&|$)'));
  await expect(page.locator('.triage-workspace')).toHaveAttribute('data-focused-id',target.id);
 }finally{await page.close();await app.close()}
});
