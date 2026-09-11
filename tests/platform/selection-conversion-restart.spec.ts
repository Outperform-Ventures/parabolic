import {test,expect,chromium} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve,join} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

test('offline selection conversion survives browser restart before reconnect',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'parabolic-conversion-restart-'));
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});
 const {url}=await app.start();
 let context=await chromium.launchPersistentContext(profile,{headless:true});
 try{
  let page=context.pages()[0];
  await page.request.post(url+'/auth/setup',{data:{name:'Restart owner',email:'restart@example.test',password:'Restart-conversion-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:state.teams[0].id,title:'Restart parent',description:'<p>Keep this offline work</p>'}})).json();
  await page.goto(url+'/issues/'+issue.id);
  let editor=page.locator('.issue-article > .rich-editor .tiptap');
  await expect(editor).toHaveText('Keep this offline work');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await editor.evaluate(e=>{(e as HTMLElement).focus();const r=document.createRange();r.selectNodeContents(e.querySelector('p')!);const s=getSelection()!;s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
  await page.getByRole('button',{name:'Create sub-issues from selection',exact:true}).click();
  await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(1);
  const href=await editor.locator('a[href^="/issues/"]').getAttribute('href');
  expect(app.repo.raw('issues',issue.id)?.description).toBe('<p>Keep this offline work</p>');
  await context.close();
  context=await chromium.launchPersistentContext(profile,{headless:true,offline:true});
  page=context.pages()[0];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/issues/'+issue.id);
  editor=page.locator('.issue-article > .rich-editor .tiptap');
  await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
  await expect(editor).toHaveText('Keep this offline work');
  expect(app.repo.raw('issues',issue.id)?.description).toBe('<p>Keep this offline work</p>');
  await editor.focus();await page.keyboard.press('ControlOrMeta+z');
  await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(0);
  await expect(editor).toHaveText('Keep this offline work');
  await editor.focus();await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
  await context.setOffline(false);
  await expect.poll(()=>app.repo.raw('issues',issue.id)?.description).toContain(href!);
  await expect.poll(()=>app.repo.raw('issues',href!.split('/').at(-1)!)?.parentId).toBe(issue.id);
  await page.reload();
  await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
  expect(errors).toEqual([]);
 }finally{await context.close();await app.close();await rm(profile,{recursive:true,force:true});}
});
