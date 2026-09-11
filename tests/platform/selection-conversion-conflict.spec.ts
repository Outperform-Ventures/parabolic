import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

for(const choice of ['Use server version','Keep my edit'])test(`offline conversion conflict: ${choice}`,async({page,context})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});
 const {url}=await app.start();
 try{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.request.post(url+'/auth/setup',{data:{name:'Conflict owner',email:'conflict@example.test',password:'Conflict-conversion-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:state.teams[0].id,title:'Conflict parent',description:'<p>Convert offline work</p>'}})).json();
  await page.goto(url+'/issues/'+issue.id);
  const editor=page.locator('.issue-article > .rich-editor .tiptap');
  await expect(editor).toHaveText('Convert offline work');
  await context.setOffline(true);
  await editor.evaluate(e=>{(e as HTMLElement).focus();const r=document.createRange();r.selectNodeContents(e.querySelector('p')!);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
  await page.getByRole('button',{name:'Create sub-issues from selection',exact:true}).click();
  await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(1);
  const href=await editor.locator('a[href^="/issues/"]').getAttribute('href');
  const childId=href!.split('/').at(-1)!;
  // APIRequestContext remains online, representing an independent device.
  const update=await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{description:'<p>New work from another device</p>'}});
  expect(update.ok()).toBe(true);
  await context.setOffline(false);
  await page.getByRole('button',{name:'Review conflicts',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Review conflicting changes',exact:true});
  await expect(dialog).toContainText('New work from another device');
  expect(app.repo.raw('issues',issue.id)?.description).toBe('<p>New work from another device</p>');
  expect(app.repo.raw('issues',childId)).toBeFalsy();
  await dialog.getByRole('button',{name:choice,exact:true}).click();
  await expect(dialog).toHaveCount(0);
  if(choice==='Use server version'){
   await expect(editor).toHaveText('New work from another device');
   await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(0);
   expect(app.repo.raw('issues',childId)).toBeFalsy();
  }else{
   await expect.poll(()=>app.repo.raw('issues',issue.id)?.description).toContain(href!);
   await expect.poll(()=>app.repo.raw('issues',childId)?.parentId).toBe(issue.id);
   await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await page.reload();
  if(choice==='Use server version')await expect(editor).toHaveText('New work from another device');
  else await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
  expect(errors).toEqual([]);
 }finally{await context.setOffline(false);await page.close();await app.close();}
});
