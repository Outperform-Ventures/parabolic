import {test,expect,type Locator} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('formatting toolbar follows visible text selection, survives menus, and clears when the caret collapses',async({page})=>{
  test.setTimeout(60_000);page.setDefaultTimeout(10_000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(`${url}/auth/setup`,{data:{name:'Selection Editor',email:'selection@example.test',password:'selection-editor-password'}});
    const content=Array.from({length:80},(_,index)=>`<p>Paragraph ${index+1}: select these words for formatting.</p>`).join('');
    const response=await page.request.post(`${url}/api/v1/documents`,{data:{title:'Long selection document',content,visibility:'workspace'}});expect(response.ok()).toBeTruthy();const document=await response.json();
    const record=async()=>await(await page.request.get(`${url}/api/v1/documents/${document.id}`)).json();
    await page.goto(`${url}/document/${document.id}`);
    const editor=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true}),toolbar=page.getByRole('toolbar',{name:'Text formatting',exact:true}),paragraph=editor.locator('p').nth(40);
    const select=async(target:Locator)=>{await target.evaluate(element=>{element.scrollIntoView({block:'center'});const range=window.document.createRange();range.selectNodeContents(element);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);(element.closest('[contenteditable="true"]') as HTMLElement).focus({preventScroll:true});window.document.dispatchEvent(new Event('selectionchange'))});await expect(toolbar).toBeVisible()};
    await paragraph.click();await page.keyboard.press('ArrowRight');await expect(toolbar).toHaveCount(0);
    await select(paragraph);
    const initial=(await toolbar.boundingBox())!,text=(await paragraph.boundingBox())!;
    expect(initial.y+initial.height).toBeLessThanOrEqual(text.y+1);expect(text.y-initial.y-initial.height).toBeLessThan(20);
    expect(initial.x).toBeGreaterThanOrEqual(8);expect(initial.x+initial.width).toBeLessThanOrEqual(page.viewportSize()!.width-8);
    await paragraph.evaluate(element=>{for(let parent=element.parentElement;parent;parent=parent.parentElement)if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){parent.scrollTop+=80;return}throw new Error('Expected a scrollable document container')});
    await expect.poll(async()=>Math.round((await toolbar.boundingBox())!.y)).toBe(Math.round(initial.y-80));
    await toolbar.getByRole('button',{name:'Bold',exact:true}).click();await expect(paragraph.locator('strong')).toHaveText('Paragraph 41: select these words for formatting.');
    await toolbar.getByRole('button',{name:'Edit link',exact:true}).click();const link=page.getByRole('dialog',{name:'Edit link',exact:true});await link.getByLabel('Link URL',{exact:true}).fill('https://example.test/selected');await link.getByRole('button',{name:'Apply',exact:true}).click();
    await expect(paragraph.locator('a')).toHaveAttribute('href','https://example.test/selected');await expect.poll(async()=>(await record()).content).toContain('https://example.test/selected');
    await editor.press('ArrowRight');await expect(toolbar).toHaveCount(0);
    await page.setViewportSize({width:640,height:620});await select(paragraph);
    const narrow=(await toolbar.boundingBox())!;expect(narrow.x).toBeGreaterThanOrEqual(8);expect(narrow.x+narrow.width).toBeLessThanOrEqual(632);expect(narrow.y).toBeGreaterThanOrEqual(8);expect(narrow.y+narrow.height).toBeLessThanOrEqual(612);
    await toolbar.getByRole('button',{name:'More formatting',exact:true}).click();await expect(page.getByRole('menu',{name:'Formatting options',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('menu',{name:'Formatting options',exact:true})).toHaveCount(0);
    await page.reload();await expect(editor.locator('p').nth(40).locator('a strong')).toHaveText('Paragraph 41: select these words for formatting.');
  }finally{await page.close();await app.close()}
});
