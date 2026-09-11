import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project overview restores an empty title and collapses the native properties card',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Overview owner',email:'overview-batch022@example.test',password:'overview-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0],project=await page.request.post(url+'/api/v1/projects',{data:{name:'Acceptance overview',teamIds:[team.id],teamId:team.id,status:'planned'}}).then(response=>response.json());
  await page.goto(url+'/project/'+project.id+'/overview');
  const title=page.getByRole('textbox',{name:'Project name',exact:true});await title.fill('   ');await title.blur();await expect(title).toHaveValue('Acceptance overview');expect(app.repo.raw('projects',project.id)?.name).toBe('Acceptance overview');
  const details=page.getByRole('complementary',{name:'Project details',exact:true}),toggle=details.getByRole('button',{name:'Collapse properties section',exact:true});await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(details.getByRole('button',{name:'Status',exact:true})).toBeVisible();await toggle.click();await expect(details.getByRole('button',{name:'Expand properties section',exact:true})).toHaveAttribute('aria-expanded','false');await expect(details.getByRole('button',{name:'Status',exact:true})).toHaveCount(0);await details.getByRole('button',{name:'Expand properties section',exact:true}).click();await expect(details.getByRole('button',{name:'Collapse properties section',exact:true})).toHaveAttribute('aria-expanded','true');await expect(details.getByRole('button',{name:'Status',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});
