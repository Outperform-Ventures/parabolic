import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project list manual and cross-group drops persist the intended fields',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project drag QA',email:'project-drag-batch10@example.test',password:'project-drag-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],create=async(data:any)=>(await(await page.request.post(url+'/api/v1/projects',{data})).json());
  const first=await create({name:'Manual first',teamIds:[team.id],status:'planned',sortOrder:100}),second=await create({name:'Manual second',teamIds:[team.id],status:'planned',sortOrder:200}),moving=await create({name:'Manual moving',teamIds:[team.id],status:'backlog',sortOrder:300});
  const record=(id:string)=>app.repo.raw('projects',id)!;
  await page.goto(url+'/projects');await expect(page.getByRole('button',{name:'Health',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Status',exact:true})).toBeVisible();await page.getByRole('button',{name:'Health',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('project-display:workspace')||'{}').sort)).toBe('health');await page.getByRole('button',{name:'Status',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('project-display:workspace')||'{}').sort)).toBe('status');await page.getByRole('button',{name:'Project display options',exact:true}).click();await page.getByLabel('Project ordering',{exact:true}).selectOption('manual');await page.keyboard.press('Escape');
  await page.locator(`[data-project-row="${moving.id}"]`).dragTo(page.locator(`[data-project-row="${first.id}"]`));
  await expect.poll(()=>record(moving.id).sortOrder).toBeLessThan(record(first.id).sortOrder);await page.reload();await expect(page.locator('tr[data-project-row]').first()).toHaveAttribute('data-project-row',moving.id);
  await page.getByRole('button',{name:'Project display options',exact:true}).click();await page.getByLabel('Project ordering',{exact:true}).selectOption('name');await page.getByLabel('Project grouping',{exact:true}).selectOption('status');await page.keyboard.press('Escape');
  await page.locator(`[data-project-row="${second.id}"]`).dragTo(page.locator(`[data-project-row="${moving.id}"]`));
  await expect.poll(()=>record(second.id).status).toBe('backlog');await page.reload();const movedRow=page.locator(`[data-project-row="${second.id}"]`);await expect(movedRow).toBeVisible();await expect(page.locator('tbody').filter({has:movedRow})).toContainText('Backlog');
 }finally{await page.close();await app.close()}
});

test('multi-team project issue tabs scope rows, creation defaults, URL and keyboard navigation',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project teams QA',email:'project-teams-batch10@example.test',password:'project-team-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),one=state.teams[0],two=app.repo.create({userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},'teams',{name:'Second project team',key:'SPT'}),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},project=app.repo.create(actor,'projects',{name:'Shared project',teamIds:[one.id,two.id],teamId:one.id}),a=app.repo.create(actor,'issues',{title:'First team issue',teamId:one.id,projectId:project.id}),b=app.repo.create(actor,'issues',{title:'Second team issue',teamId:two.id,projectId:project.id});
  await page.goto(url+'/project/'+project.id+'/issues');const tabs=page.getByRole('tablist',{name:'Project issue teams',exact:true});await expect(tabs.getByRole('tab')).toHaveText(['All teams',one.name,two.name]);await expect(page.locator(`[data-issue-id="${a.id}"]`)).toBeVisible();await expect(page.locator(`[data-issue-id="${b.id}"]`)).toBeVisible();
  await tabs.getByRole('tab',{name:two.name,exact:true}).click();await expect(page).toHaveURL(new RegExp('team='+two.id));await expect(page.locator(`[data-issue-id="${a.id}"]`)).toHaveCount(0);await expect(page.locator(`[data-issue-id="${b.id}"]`)).toBeVisible();await page.reload();await expect(tabs.getByRole('tab',{name:two.name,exact:true})).toHaveAttribute('aria-selected','true');
  await tabs.getByRole('tab',{name:two.name,exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(tabs.getByRole('tab',{name:one.name,exact:true})).toHaveAttribute('aria-selected','true');await expect(page).toHaveURL(new RegExp('team='+one.id));
  await page.getByRole('button',{name:'New issue',exact:true}).click();const composer=page.getByRole('dialog',{name:'Dialog',exact:true});await composer.getByRole('textbox',{name:'Issue title',exact:true}).fill('Created in selected project team');await composer.getByRole('button',{name:/Create issue/}).click();await expect.poll(()=>app.repo.all('issues',state.workspaceId).find(issue=>issue.title==='Created in selected project team')?.teamId).toBe(one.id);expect(app.repo.all('issues',state.workspaceId).find(issue=>issue.title==='Created in selected project team')?.projectId).toBe(project.id);
 }finally{await page.close();await app.close()}
});

test('project edit supports exact multi-team replacement and retired details are read-only',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project edit QA',email:'project-edit-batch10@example.test',password:'project-edit-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},one=state.teams[0],two=app.repo.create(actor,'teams',{name:'Replacement team',key:'RPT'}),project=app.repo.create(actor,'projects',{name:'Replace project teams',teamIds:[one.id],teamId:one.id});
  await page.goto(url+'/project/'+project.id);await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Edit details',exact:true}).click();const form=page.getByRole('dialog',{name:'Edit project',exact:true});await form.getByRole('button',{name:'Teams',exact:true}).click();const picker=page.getByRole('dialog',{name:'Change Teams',exact:true});await picker.getByRole('option',{name:one.name,exact:true}).click();await picker.getByRole('option',{name:two.name,exact:true}).click();await page.keyboard.press('Escape');await form.getByRole('button',{name:'Save changes',exact:true}).click();await expect.poll(()=>app.repo.raw('projects',project.id)?.teamIds).toEqual([two.id]);expect(app.repo.raw('projects',project.id)?.teamId).toBe(two.id);
  app.repo.save('teams',{...app.repo.raw('teams',two.id)!,archivedAt:new Date().toISOString(),retiredAt:new Date().toISOString()},'update',{...actor,system:true});await page.reload();const sidebar=page.getByRole('complementary',{name:'Project details',exact:true});await expect(page.getByRole('status').filter({hasText:'read-only'})).toBeVisible();await expect(sidebar.getByRole('button',{name:'Status',exact:true})).toBeDisabled();await expect(sidebar.getByRole('button',{name:'Add sidebar milestone',exact:true})).toBeDisabled();
 }finally{await page.close();await app.close()}
});
