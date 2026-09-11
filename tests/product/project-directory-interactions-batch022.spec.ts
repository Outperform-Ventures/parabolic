import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project directory click and keyboard entry use the explicit overview route',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Directory QA',email:'project-directory-batch22@example.test',password:'project-directory-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Directory route project',teamIds:[state.teams[0].id],status:'planned'}})).json();
  await page.goto(url+'/projects');const row=page.locator(`[data-project-row="${project.id}"]`);
  await row.locator('td').first().click({position:{x:70,y:20}});await expect(page).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
  await page.goto(url+'/projects');await row.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
  await page.goto(url+'/projects');await page.getByRole('button',{name:'Project display options'}).click();await page.getByRole('button',{name:'Board layout'}).click();await page.keyboard.press('Escape');
  await page.locator(`[data-project-row="${project.id}"]`).click();await expect(page).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
 }finally{await page.close();await app.close()}
});
