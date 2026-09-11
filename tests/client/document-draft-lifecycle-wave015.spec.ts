import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page:any,name:string){
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve(process.env.PARABOLIC_TEST_DIST??'dist')}),{url}=await app.start();
 await page.request.post(url+'/auth/setup',{data:{name:'Wave 015 draft owner',email:`wave015-document-${name}@example.test`,password:'document-draft-password'}});
 const state=await page.request.get(url+'/api/v1/state').then((response:any)=>response.json());
 return {app,url,state,team:state.teams[0]};
}

test('untouched route-first drafts are discarded through Back and breadcrumb exits',async({page})=>{
 const f=await fixture(page,'discard');
 try{
  for(const exit of ['back','breadcrumb'] as const){
   await page.goto(`${f.url}/team/${f.team.id}/documents`);
   await page.getByRole('button',{name:'New document',exact:true}).click();
   await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toBeFocused();
   const draft=f.app.repo.all('documents',f.state.workspaceId).find((item:any)=>item.isNewDocumentDraft&&!item.deletedAt);
   expect(draft).toBeTruthy();
   let deleteRequests=0;
   const countDelete=(request:any)=>{if(request.method()==='DELETE'&&new URL(request.url()).pathname===`/api/v1/documents/${draft!.id}`)deleteRequests++};
   page.on('request',countDelete);
   if(exit==='back')await page.goBack();else await page.getByRole('link',{name:'Documents',exact:true}).click();
   await expect.poll(()=>!!f.app.repo.raw('documents',draft!.id,true)?.deletedAt).toBe(true);
   await page.waitForTimeout(150);
   page.off('request',countDelete);
   expect(deleteRequests).toBe(1);
  }
 }finally{await page.close();await f.app.close()}
});

test('typing a title converts the draft into a retained document before exit',async({page})=>{
 const f=await fixture(page,'retain');
 try{
  for(const exit of ['back','breadcrumb'] as const){
   await page.goto(`${f.url}/team/${f.team.id}/documents`);
   await page.getByRole('button',{name:'New document',exact:true}).click();
   await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toBeFocused();
   const draft=f.app.repo.all('documents',f.state.workspaceId).find((item:any)=>item.isNewDocumentDraft&&!item.deletedAt);
   expect(draft).toBeTruthy();
   let updates=0,deletes=0;
   const countRequest=(request:any)=>{
    if(request.method()==='DELETE'&&new URL(request.url()).pathname===`/api/v1/documents/${draft!.id}`)deletes++;
    if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/batch'&&request.postDataJSON()?.operations?.some((operation:any)=>operation.kind==='documents'&&operation.action==='update'&&operation.id===draft!.id))updates++;
   };
   page.on('request',countRequest);
   const expectedTitle=`Retained Wave 015 document ${exit}`;
   await page.getByRole('textbox',{name:'Document title',exact:true}).fill(expectedTitle);
   if(exit==='back')await page.goBack();else await page.getByRole('link',{name:'Documents',exact:true}).click();
   await expect.poll(()=>f.app.repo.raw('documents',draft!.id,true)?.title).toBe(expectedTitle);
   await page.waitForTimeout(250);
   page.off('request',countRequest);
   const document=f.app.repo.raw('documents',draft!.id,true);
   expect(document!.deletedAt).toBeFalsy();
   expect(document!.isNewDocumentDraft).toBeFalsy();
   expect(updates).toBe(1);
   expect(deletes).toBe(0);
  }
 }finally{await page.close();await f.app.close()}
});
