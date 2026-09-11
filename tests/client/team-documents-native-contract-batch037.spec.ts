import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('team documents expose the captured controls and sortable collection headers',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Team documents QA',email:'team-documents-batch037@example.test',password:'team-documents-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  app.repo.create(actor,'documents',{teamId:team.id,title:'Alpha handbook',userId:state.user.id,content:''});
  app.repo.create(actor,'documents',{teamId:team.id,title:'Zulu runbook',userId:state.user.id,content:''});
  await page.goto(url+'/team/'+team.id+'/documents');
  const toolbarButtons=page.locator('.team-documents-tabs').getByRole('button');await expect(toolbarButtons).toHaveCount(3);expect(await toolbarButtons.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')||node.textContent?.trim()))).toEqual(['New document','Add filter','Display options']);
  const headerButtons=page.locator('.team-documents-table thead').getByRole('button');await expect(headerButtons).toHaveCount(4);expect(await headerButtons.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).toEqual(['A-Z','Order by Created','Order by Last edited','Order by Owner']);
  const rows=page.locator('.team-documents-table tbody tr[role="link"]');
  await expect(rows).toHaveCount(2);await expect(rows).toContainText(['Alpha handbook','Zulu runbook']);
  await page.getByRole('button',{name:'A-Z',exact:true}).click();await expect(rows).toContainText(['Zulu runbook','Alpha handbook']);
  await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.getByRole('option',{name:'Advanced filter',exact:true}).click();await page.getByRole('textbox',{name:'Filter documents',exact:true}).fill('alpha');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha handbook');
  await page.getByRole('button',{name:'New document',exact:true}).click();await expect(page).toHaveURL(/\/document\//);await expect(page.getByRole('textbox',{name:'Document title'})).toBeFocused();const draft=app.repo.all('documents',state.workspaceId).find(item=>item.isNewDocumentDraft);expect(draft).toBeTruthy();await page.goBack();await expect.poll(()=>app.repo.raw('documents',draft!.id,true)?.deletedAt).toBeTruthy();
 }finally{await page.close();await app.close()}
});

test('team document groups collapse and rows select, expose actions, and open with the keyboard',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Team documents rows',email:'team-document-rows-batch037@example.test',password:'team-document-rows-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},document=app.repo.create(actor,'documents',{teamId:team.id,title:'Operations guide',userId:state.user.id,content:''});
  await page.goto(url+'/team/'+team.id+'/documents');
  const row=page.locator('[data-document-id="'+document.id+'"]');await expect(row).toHaveRole('link');await expect(row).toHaveAccessibleName(/Select document Operations guide .* Team documents rows .* Open menu/);
  await expect(row.getByRole('button',{name:'Open menu',exact:true})).toBeVisible();
  await row.getByRole('checkbox',{name:'Select document Operations guide',exact:true}).check();await expect(row).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Collapse group',exact:true}).click();await expect(row).toHaveCount(0);await page.getByRole('button',{name:'Expand group',exact:true}).click();
  await row.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(url+'/document/'+document.id);
 }finally{await page.close();await app.close()}
});
