import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('retired-team documents stay readable while document and comment writes are disabled',async({page})=>{
 test.setTimeout(60_000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Document owner',email:'document-access@example.test',password:'document-access-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const document=app.repo.create(actor,'documents',{title:'Retained team knowledge',teamId:team.id,content:'<p>Readable after retirement</p>',visibility:'workspace'});
  app.repo.update(actor,'documents',document.id,{content:'<p>Readable current version</p>'});
  app.repo.create(actor,'comments',{documentId:document.id,body:'<p>Retained discussion</p>'});
  app.repo.save('teams',{...app.repo.raw('teams',team.id)!,archivedAt:new Date().toISOString(),retiredAt:new Date().toISOString()},'update',actor);

  await page.goto(url+'/document/'+document.id);
  await expect(page.getByRole('status').filter({hasText:'This team is retired.'})).toHaveText('This team is retired. This document is read-only.');
  await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toHaveJSProperty('readOnly',true);
  await expect(page.locator('.feature-document .tiptap').first()).toHaveAttribute('contenteditable','false');
  await expect(page.getByText('Readable current version',{exact:true})).toBeVisible();
  await expect(page.getByText('Retained discussion',{exact:true})).toBeVisible();
  await expect(page.getByText('Leave a comment…',{exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'Document options',exact:true}).click();
  for(const name of ['Move to','Pin to team','Duplicate','Rename…','Delete'])await expect(page.getByRole('menuitem',{name,exact:true})).toHaveCount(0);
  await expect(page.getByRole('menuitem',{name:'Copy link',exact:true})).toBeVisible();
  await page.getByRole('menuitem',{name:'Show document history',exact:true}).click();
  await expect(page.locator('.feature-history-version')).toBeDisabled();

  await page.getByRole('button',{name:'Document subscribers',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox')).toBeDisabled();
  await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();

  expect((await page.request.patch(url+'/api/v1/documents/'+document.id,{data:{title:'Forbidden edit'}})).status()).toBe(403);
  expect((await page.request.post(url+'/api/v1/comments',{data:{documentId:document.id,body:'Forbidden comment'}})).status()).toBe(403);
 }finally{await app.close()}
});

test('document detail distinguishes archived, deleted, and unavailable records and restores retained records',async({page})=>{
 test.setTimeout(60_000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Recovery owner',email:'document-recovery@example.test',password:'document-recovery-password'}});
  const created=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Recoverable document',content:'<p>Retained content</p>',visibility:'workspace'}})).json();

  await page.request.patch(url+'/api/v1/documents/'+created.id,{data:{archivedAt:new Date().toISOString()}});
  await page.goto(url+'/document/'+created.id);
  await expect(page.getByText('Document archived',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore document',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toHaveValue('Recoverable document');

  await page.request.delete(url+'/api/v1/documents/'+created.id);
  await page.reload();
  await expect(page.getByText('Document deleted',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore document',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toHaveValue('Recoverable document');

  await page.goto(url+'/document/00000000-0000-4000-8000-000000000000');
  await expect(page.getByText('Document unavailable',{exact:true})).toBeVisible();
  await expect(page.getByText('The document does not exist or you do not have access to it.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Back to documents',exact:true})).toBeVisible();
 }finally{await app.close()}
});
