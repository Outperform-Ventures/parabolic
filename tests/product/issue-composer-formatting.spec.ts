import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('Enter in a collapsible heading moves or splits text into its body without losing existing paragraphs',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Editor owner',email:'collapse-enter@example.test',password:'test-password'}});
  await page.goto(url+'/my-issues');await page.getByRole('button',{name:'New issue',exact:true}).click();
  const editor=page.locator('.issue-composer [contenteditable=true]');await editor.fill('Temporary collapse comparison');await editor.selectText();
  await page.getByRole('toolbar',{name:'Text formatting'}).getByRole('button',{name:'Collapse',exact:true}).click();
  const summary=editor.locator('summary'),body=editor.locator('[data-type=detailsContent]');
  const place=async(offset:number)=>editor.evaluate((el:any,n)=>{el.editor.commands.setTextSelection(2+n);el.editor.view.focus()},offset);
  await place(29);await page.keyboard.press("Enter");await page.keyboard.type('Body continuation');
  await expect(summary).toHaveText('Temporary collapse comparison');await expect(body.locator('p')).toHaveText(['Body continuation']);
  await place(10);
  await page.keyboard.press('Enter');await expect(summary).toHaveText('Temporary ');await expect(body.locator('p')).toHaveText(['collapse comparison','Body continuation']);
  await page.keyboard.press('ControlOrMeta+z');await expect(summary).toHaveText('Temporary collapse comparison');await expect(body.locator('p')).toHaveText(['Body continuation']);
  await page.keyboard.press('Home');await page.keyboard.press('Enter');await expect(summary).toHaveText('Temporary collapse comparison');await expect(body.locator('p')).toHaveText(['Body continuation']);await expect(editor.locator('>p:first-child')).toHaveText('');
 }finally{await page.close();await app.close()}
});

test('issue composer exposes native formatting controls and preserves formatting when created',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Composer owner',email:'composer-format@example.test',password:'test-password'}});
  await page.goto(url+'/my-issues');await page.getByRole('button',{name:'New issue',exact:true}).click();
  const composer=page.locator('.issue-composer'),editor=composer.locator('[contenteditable=true]'),toolbar=page.getByRole('toolbar',{name:'Text formatting',exact:true});
  await composer.getByLabel('Issue title',{exact:true}).fill('Formatted composer issue');await editor.fill('Keep this formatted text');
  const select=async()=>{await editor.evaluate(el=>{const target=Array.from(el.querySelectorAll('p,h1,h2,h3,h4,code,summary')).find(node=>node.textContent?.includes('Keep this formatted text'))!;const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);const range=document.createRange();range.setStart(nodes[0],0);range.setEnd(nodes.at(-1)!,nodes.at(-1)!.length);const s=getSelection()!;s.removeAllRanges();s.addRange(range);(el as HTMLElement).focus();document.dispatchEvent(new Event('selectionchange'));});await expect(toolbar).toBeVisible();};
  await select();await expect(toolbar.getByRole('button',{name:'Regular text',exact:true}).locator('[data-glyph=Text]')).toBeVisible();
  for(const n of [1,2,3,4]){
   await select();await toolbar.getByRole('button',{name:'Regular text',exact:true}).click();await page.getByRole('menuitemradio',{name:'Heading '+n,exact:false}).click();await expect(editor.locator('h'+n)).toHaveText('Keep this formatted text');
   await select();const heading=toolbar.getByRole('button',{name:'Heading '+n,exact:true});await expect(heading.locator('[data-glyph=Heading'+n+']')).toBeVisible();await expect(toolbar.getByRole('button',{name:'Bold',exact:true})).toBeDisabled();await expect(toolbar.getByRole('button',{name:'List',exact:true})).toBeDisabled();
   await heading.click();await page.getByRole('menuitemradio',{name:'Regular text',exact:false}).click();await select();await expect(toolbar.getByRole('button',{name:'Bold',exact:true})).toBeEnabled();await expect(toolbar.getByRole('button',{name:'List',exact:true})).toBeEnabled();
  }
  for(const [name,selector] of [['List','ul:not([data-type=taskList])'],['Numbered list','ol'],['Checklist','ul[data-type=taskList]']]){
   await select();await toolbar.getByRole('button',{name:'List',exact:true}).click();await page.getByRole('menuitemradio',{name,exact:true}).click();await expect(editor.locator(selector)).toContainText('Keep this formatted text');
   await select();await expect(toolbar.getByRole('button',{name:'Regular text',exact:true})).toBeDisabled();const activeList=toolbar.getByRole('button',{name,exact:true});await expect(activeList.locator('[data-glyph='+({List:'List','Numbered list':'NumberedList',Checklist:'Checklist'}[name])+']')).toBeVisible();await activeList.click();await expect(page.getByRole('menuitemradio',{name,exact:true})).toHaveAttribute('aria-checked','true');await page.getByRole('menuitemradio',{name,exact:true}).click();await expect(editor.locator(selector)).toHaveCount(0);await select();await expect(toolbar.getByRole('button',{name:'Regular text',exact:true})).toBeEnabled();
  }
  for(const [name,selector] of [['Quote','blockquote'],['Code block','pre']]){
   await select();await toolbar.getByRole('button',{name,exact:true}).click();await expect(editor.locator(selector)).toContainText('Keep this formatted text');
   await select();await toolbar.getByRole('button',{name,exact:true}).click();await expect(editor.locator(selector)).toHaveCount(0);
  }
  await select();await toolbar.getByRole('button',{name:'Collapse',exact:true}).click();await expect(editor.locator('summary')).toHaveText('Keep this formatted text');
  const details=editor.locator('details'),summary=details.locator('summary');
  await summary.locator('span').click();await expect(details).toHaveAttribute('open','');
  await details.getByRole('button',{name:'Collapse section',exact:true}).click();
  await expect(details).not.toHaveAttribute('open','');await expect(details.locator('[data-type=detailsContent]')).toBeHidden();
  await details.getByRole('button',{name:'Expand section',exact:true}).click();await expect(details).toHaveAttribute('open','');
  await expect(details.locator('[data-type=detailsContent]')).toBeVisible();
  await summary.locator('span').click();await page.keyboard.press('End');await page.keyboard.type(' edited');await expect(summary).toHaveText('Keep this formatted text edited');
  await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');
  await expect(summary).toHaveText('Keep this formatted text');
  await composer.getByLabel('Create more',{exact:true}).uncheck();await composer.getByRole('button',{name:'Create issue',exact:true}).click();await expect(composer).toHaveCount(0);
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),issue=state.issues.find((i:any)=>i.title==='Formatted composer issue');expect(issue.description).toContain('<details');
  await page.goto(url+'/issues/'+issue.id);await expect(page.locator('.issue-article .rich-editor summary')).toHaveText('Keep this formatted text');
 }finally{await page.close();await app.close();}
});
