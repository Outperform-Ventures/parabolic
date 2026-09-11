import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
for(const layout of ['list','board'])test(`${layout} context menu targets an unselected issue without entering bulk selection`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'context-owner@example.test',name:'Owner',password:'context-owner-strong'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const create=async(kind:string,data:unknown)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok(),await r.text()).toBeTruthy();return r.json()};
  const first=await create('issues',{title:'First context target',teamId:team.id}),second=await create('issues',{title:'Second context target',teamId:team.id});
  const view=await create('views',{name:'Context selection',entityType:'issues',teamId:team.id,layout,display:{layout,groupBy:'statusId',showEmpty:false,showCompleted:true}});
  await page.goto(url+'/view/'+view.id);const row=(id:string)=>page.locator(`[data-issue-id="${id}"]`).first();
  await row(first.id).click({button:'right'});await expect(page.getByRole('menuitem').filter({hasText:'Delete'}).last()).toBeVisible();await expect(page.getByRole('toolbar',{name:'Selected issues'})).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);
  if(layout==='list'){await row(first.id).getByRole('button',{name:/Select /}).click();await row(second.id).getByRole('button',{name:/Select /}).click();}
  else{await row(first.id).click({modifiers:['ControlOrMeta']});await row(second.id).click({modifiers:['ControlOrMeta']});}
  await expect(page.getByRole('toolbar',{name:'Selected issues'})).toContainText('2');await row(first.id).click({button:'right'});await expect(page.getByRole('toolbar',{name:'Selected issues'})).toContainText('2');
 }finally{await app.close()}
});
