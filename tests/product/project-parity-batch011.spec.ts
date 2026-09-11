import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project directory context menu matches the native inventory and measured geometry',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project context QA',email:'project-context-batch11@example.test',password:'project-context-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Native context project',teamIds:[state.teams[0].id],status:'planned'}})).json();
  await page.goto(url+'/projects');const row=page.locator(`[data-project-row="${project.id}"]`);await row.click({button:'right'});
  const menu=page.locator('.project-context-menu');await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['Status›','Priority›','Project lead›','Members›','Start date…','Target date…','Teams›','Labels›','More properties›','Copy›','Move›','Open in›','Favorite⌥ F','Subscribe›','Remind me⇧ H','New comment…N then C','Delete']);
  const box=await menu.boundingBox();expect(box?.width).toBe(229);expect(box?.height).toBe(602);
  await menu.getByRole('menuitem',{name:/^Status/}).click();await expect(page.getByRole('dialog',{name:'Change Status',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});

test('project directory headers use the measured native weight and Health offset',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project header QA',email:'project-header-batch11@example.test',password:'project-header-password'}});await page.goto(url+'/projects');
  const name=page.getByRole('button',{name:'Name',exact:true}),health=page.getByRole('button',{name:'Health',exact:true}),status=page.getByRole('button',{name:'Status',exact:true});
  for(const header of [name,health,status])await expect(header).toHaveCSS('font-weight','500');
  const healthBox=await health.boundingBox(),healthCell=await page.locator('th[data-project-column="health"]').boundingBox(),statusBox=await status.boundingBox(),statusCell=await page.locator('th[data-project-column="status"]').boundingBox();
  expect(healthBox!.y-healthCell!.y).toBeCloseTo(4.75,2);expect(statusBox!.y-statusCell!.y).toBeCloseTo(4,2);
 }finally{await page.close();await app.close()}
});
