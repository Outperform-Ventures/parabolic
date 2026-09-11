import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('selected issue palette opens native property actions and uses current selection for self-assignment',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Command context',email:'commands@example.test',password:'command-context-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const created:Array<{id:string}>=[];for(const title of ['Command first','Command second'])created.push(await(await page.request.post(url+'/api/v1/issues',{data:{title,teamId:state.teams[0].id,assigneeId:state.user.id}})).json());
  await page.goto(url+'/issues/all');await page.getByText('Command first',{exact:true}).hover();await page.keyboard.press('x');
  await page.keyboard.press('Meta+k');const palette=page.locator('.workspace-command-palette');
  await expect(palette.getByRole('option').first()).toContainText('Assign to…');
  await expect(palette.getByRole('option').filter({hasText:'Un-assign from me'})).toHaveCount(1);
  await expect(palette.getByRole('combobox')).toBeFocused();await page.keyboard.press('ArrowDown');
  await expect(palette.getByRole('combobox')).toHaveAttribute('aria-activedescendant','quick-result-1');
  await page.keyboard.press('Escape');await page.getByText('Command second',{exact:true}).hover();await page.keyboard.press('x');await page.keyboard.press('Meta+k');
  await expect(palette.getByText('2 issues',{exact:true})).toBeVisible();
  await expect(palette.getByRole('option').filter({hasText:'Copy issue IDs'})).toHaveCount(1);
  await palette.getByRole('option').filter({hasText:'Un-assign from me'}).click();
  await expect(palette).toHaveCount(0);
  await expect.poll(()=>created.map(issue=>app.repo.raw('issues',issue.id)?.assigneeId??null)).toEqual([null,null]);
 }finally{await page.close();await app.close();}
});

test('project detail palette exposes native project inventory and dispatches a project property editor',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project commands',email:'project-commands@example.test',password:'project-command-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Honey Rock Group',teamIds:[state.teams[0].id],status:'planned'}})).json();
  await page.goto(url+'/project/'+project.id);await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue('Honey Rock Group');await page.keyboard.press('Meta+k');const palette=page.locator('.workspace-command-palette');
  await expect(palette.getByText('Project ⋅ Honey Rock Group',{exact:true})).toBeVisible();
  await expect(palette.getByRole('option').first()).toContainText('Edit project…');
  await expect(palette.getByRole('option').nth(1)).toContainText('Change project status…');
  await expect(palette.getByRole('option').nth(7)).toContainText('Rename project');
  await palette.getByRole('option').filter({hasText:'Change project status…'}).click();await expect(page.getByRole('dialog',{name:'Change Status'})).toBeVisible();
 }finally{await page.close();await app.close();}
});
