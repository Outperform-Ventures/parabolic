import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('team directory uses rows, excludes deleted projects and opens linked destinations',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Directory owner',email:'directory@example.test',password:'isolated-directory-test',workspaceName:'Directory'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  await page.request.post(url+'/api/v1/projects',{data:{name:'Active project',teamIds:[team.id],status:'planned'}});
  const deleted=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Deleted project',teamIds:[team.id],status:'planned'}})).json();
  await page.request.delete(url+'/api/v1/projects/'+deleted.id);
  await page.goto(url+'/teams');await expect(page.getByRole('table',{name:'Teams'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open team projects page',exact:true})).toHaveAttribute('title',team.name+': 1 active projects');
  await page.getByLabel('Find teams…').fill('absent');await expect(page.getByText('No teams matching the filters',{exact:true})).toBeVisible();
  await page.getByLabel('Find teams…').fill('');await page.getByRole('link',{name:'Open team projects page',exact:true}).click();await expect(page).toHaveURL(new RegExp('/team/'+team.id+'/projects'));
  await page.goto(url+'/teams');await page.getByRole('button',{name:'Create new team',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Research');await page.getByLabel('Identifier',{exact:true}).fill('RES');await page.getByRole('button',{name:'Create',exact:true}).click();await expect(page).toHaveURL(/\/team\/[^/]+\/overview/);
 }finally{await app.close();}
});
