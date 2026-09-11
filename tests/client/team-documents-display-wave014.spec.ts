import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('team documents include project resources and expose native display controls',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Wave 014 document owner',email:'wave014-documents@example.test',password:'documents-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const active=app.repo.create(actor,'projects',{name:'Active resource project',teamIds:[team.id]}),inactive=app.repo.create(actor,'projects',{name:'Inactive resource project',teamIds:[team.id],status:'completed',completedAt:new Date().toISOString()});
  app.repo.create(actor,'documents',{title:'Team handbook',teamId:team.id,userId:state.user.id});
  app.repo.create(actor,'documents',{title:'Active project brief',projectId:active.id,userId:state.user.id});
  app.repo.create(actor,'documents',{title:'Inactive project brief',projectId:inactive.id,userId:state.user.id});

  await page.goto(url+'/team/'+team.id+'/documents');
  await expect(page.locator('[data-document-group="team"]')).toContainText('Team handbook');
  await expect(page.locator(`[data-document-group="${active.id}"]`)).toContainText('Active project brief');
  await expect(page.getByText('Inactive project brief',{exact:true})).toHaveCount(0);

  const trigger=page.getByRole('button',{name:'Display options',exact:true});
  await trigger.click();
  await expect(page.getByRole('combobox',{name:'Grouping',exact:true})).toHaveValue('project');
  await expect(page.getByRole('combobox',{name:'Ordering',exact:true})).toHaveValue('name');
  await expect(page.getByRole('button',{name:'Direction',exact:true})).toHaveText('Ascending');
  await expect(page.getByRole('checkbox',{name:'Show inactive projects',exact:true})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Show only my projects',exact:true})).not.toBeChecked();
  await expect(page.getByText('Display properties',{exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Last edited',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:/Last edited/})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Show inactive projects',exact:true}).check();
  await expect(page.locator(`[data-document-group="${inactive.id}"]`)).toContainText('Inactive project brief');
  await page.getByRole('combobox',{name:'Grouping',exact:true}).selectOption('none');
  await expect(page.locator('[data-document-group="all"]')).toContainText('Active project brief');
  await expect(page.locator('[data-document-group="all"]')).toContainText('Inactive project brief');
  await page.getByRole('button',{name:'Direction',exact:true}).click();
  await expect(page.getByRole('button',{name:'Direction',exact:true})).toHaveText('Descending');
  await page.getByRole('checkbox',{name:'Show only my projects',exact:true}).check();
  await expect(page.getByText('Active project brief',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Inactive project brief',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Team handbook',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
 }finally{await app.close()}
});
