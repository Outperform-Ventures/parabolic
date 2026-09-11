import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';

test('team cycles use team-scoped detail routes and expose the captured collection favorite',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Team cycles QA',email:'team-cycles-batch036@example.test',password:'team-cycles-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const current=app.repo.create(actor,'cycles',{teamId:team.id,name:'Scoped current',startDate:new Date(Date.now()-86400000).toISOString(),endDate:new Date(Date.now()+86400000).toISOString()});
  const upcoming=app.repo.create(actor,'cycles',{teamId:team.id,name:'Scoped upcoming',startDate:new Date(Date.now()+2*86400000).toISOString(),endDate:new Date(Date.now()+4*86400000).toISOString()});
  await page.goto(url+'/team/'+team.id+'/cycles');
  const favorite=page.getByRole('switch',{name:'Add to favorites',exact:true});await expect(favorite).toHaveAttribute('aria-checked','false');await favorite.click();
  await expect(page.getByRole('switch',{name:'Remove from favorites',exact:true})).toHaveAttribute('aria-checked','true');
  await expect.poll(()=>app.repo.all('favorites',state.workspaceId).find(item=>item.entityId===team.id&&item.section==='cycles')?.route).toBe('/team/'+team.id+'/cycles');
  await page.locator('[data-cycle-id="'+upcoming.id+'"]').click();await expect(page).toHaveURL(url+'/team/'+team.id+'/cycle/'+upcoming.id);await expect(page.locator('.feature-heading')).toHaveText('Scoped upcoming');
  await page.goto(url+'/team/'+team.id+'/cycles');const row=page.locator('[data-cycle-id="'+current.id+'"]');await row.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(url+'/team/'+team.id+'/cycle/'+current.id);
 }finally{await page.close();await app.close()}
});
