import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
import {defaultInsight} from '../../src/client/features/insight-data';

test('guest dashboards require explicit team scope and never expose workspace-wide data',async({page,browser})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),context=await browser.newContext(),guest=await context.newPage();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'dash-guest-owner@example.test',name:'Owner',password:'dash-guest-owner-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],invite=await create('invitations',{email:'dash-guest@example.test',role:'guest',teamIds:[team.id]});
  expect((await guest.request.post(url+'/auth/join',{data:{token:invite.token,name:'Guest',password:'dash-guest-password'}})).ok()).toBeTruthy();
  await create('issues',{teamId:team.id,title:'Guest visible issue'});
  const dashboard=await create('dashboards',{name:'Guest shared dashboard',visibility:'workspace',widgets:[{...defaultInsight,id:'guest-widget',name:'Issue count'}]});
  await guest.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).copied=value}}})});
  await guest.goto(url+'/dashboards/'+dashboard.id);await expect(guest.getByRole('heading',{name:'Dashboard not found',exact:true})).toBeVisible();
  await expect(guest.getByRole('heading',{name:'Issue count',exact:true})).toHaveCount(0);
  expect((await guest.request.patch(url+'/api/v1/dashboards/'+dashboard.id,{data:{name:'Unauthorized edit'}})).status()).toBe(404);
  // Team-scoped dashboards follow the same explicit-team edit policy as other operational resources.
  const teamDashboard=await create('dashboards',{name:'Joined team dashboard',teamId:team.id,visibility:'workspace',widgets:[{...defaultInsight,id:'team-widget',name:'Issue count'}]});
  await guest.goto(url+'/dashboards/'+teamDashboard.id);await expect(guest.getByText('1 matching issues',{exact:true})).toBeVisible();
  await expect(guest.getByRole('button',{name:'Add insight',exact:true})).toBeVisible();
  await guest.getByRole('button',{name:'Refresh',exact:true}).click();await expect(guest.getByText('1 matching issues',{exact:true})).toBeVisible();
  await guest.getByRole('button',{name:'Explore Issue count issues',exact:true}).click();await guest.getByRole('dialog').getByRole('link',{name:/Guest visible issue/}).click();await expect(guest).toHaveURL(/\/issues\//);await expect(guest.getByLabel('Issue title',{exact:true})).toHaveValue('Guest visible issue');
  expect((await guest.request.patch(url+'/api/v1/dashboards/'+teamDashboard.id,{data:{name:'Joined team edit'}})).ok()).toBeTruthy();
 }finally{await context.close();await app.close()}
});
