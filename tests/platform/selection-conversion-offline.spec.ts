import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('offline selection conversion updates local description and syncs after reconnect',async({page,context})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.request.post(`${url}/auth/setup`,{data:{name:'Offline owner',email:'offline-conversion@example.test',password:'Offline-conversion-password'}});
    const state=await(await page.request.get(`${url}/api/v1/state`)).json();
    const issue=await(await page.request.post(`${url}/api/v1/issues`,{data:{teamId:state.teams[0].id,title:'Offline conversion parent',description:'<p>Prepare offline work</p>'}})).json();
    await page.goto(`${url}/issues/${issue.id}`);
    const editor=page.locator('.issue-article > .rich-editor .tiptap');
    await expect(editor).toHaveText('Prepare offline work');
    await context.setOffline(true);
    await expect.poll(()=>page.evaluate(()=>navigator.onLine)).toBe(false);
    await editor.evaluate(element=>{(element as HTMLElement).focus();const range=document.createRange();range.selectNodeContents(element.querySelector('p')!);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
    await page.getByRole('button',{name:'Create sub-issues from selection',exact:true}).click();
    await expect(page.locator('.issue-composer')).toHaveCount(0);
    await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(1);
    expect(app.repo.raw('issues',issue.id)?.description).toBe('<p>Prepare offline work</p>');
    const href=await editor.locator('a[href^="/issues/"]').getAttribute('href');
    await editor.focus();await page.keyboard.press('ControlOrMeta+z');
    await expect(editor.locator('a[href^="/issues/"]')).toHaveCount(0);
    await expect(editor).toHaveText('Prepare offline work');
    await editor.focus();await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
    await editor.evaluate(element=>{(element as HTMLElement).focus();const range=document.createRange();range.selectNodeContents(element);range.collapse(false);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
    await page.keyboard.press('End');await page.keyboard.type(' More context',{delay:10});
    await expect(editor).toHaveText('Prepare offline work More context');
    await page.screenshot({path:'artifacts/verification/issue-filter-parity/selection-conversion-offline-final-172.png'});
    await context.setOffline(false);
    await expect.poll(()=>app.repo.raw('issues',issue.id)?.description).toContain(href!);
    await expect.poll(()=>app.repo.raw('issues',issue.id)?.description).toContain('More context');
    const childId=href!.split('/').at(-1)!;
    await expect.poll(()=>app.repo.raw('issues',childId)?.parentId).toBe(issue.id);
    await page.reload();await expect(editor.locator(`a[href="${href}"]`)).toHaveCount(1);
    await expect(editor).toContainText('More context');expect(errors).toEqual([]);
  }finally{await context.setOffline(false);await page.close();await app.close();}
});
