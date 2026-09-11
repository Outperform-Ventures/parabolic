import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('document heading links copy, survive rename and reload, and navigate to the section without an opening edit',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copiedHeading=text}}})});
 await page.request.post(url+'/auth/setup',{data:{name:'Heading owner',email:'heading@example.test',password:'heading-password'}});
 const content='<h2>Introduction</h2>'+Array.from({length:35},(_,i)=>`<p>Paragraph ${i+1} with document content.</p>`).join('')+'<h2>Target section</h2><p>Section body.</p>';
 const response=await page.request.post(url+'/api/v1/documents',{data:{title:'Heading links',content,visibility:'workspace'}});expect(response.ok()).toBeTruthy();const doc=await response.json();
 const current=async()=>(await page.request.get(url+'/api/v1/documents/'+doc.id)).json();
 await page.goto(url+'/document/'+doc.id);const heading=page.locator('.tiptap h2').filter({hasText:'Target section'});await expect(heading).toBeVisible();await heading.hover();
 const copy=page.getByRole('button',{name:'Copy link to Target section',exact:true});await expect(copy).toHaveCSS('opacity','1');await copy.click();
 const link=await page.evaluate(()=>(window as any).__copiedHeading);expect(link).toMatch(new RegExp('/document/'+doc.id+'#heading-'));const anchor=await heading.getAttribute('id');expect(new URL(link).hash).toBe('#'+anchor);
 expect((await current()).version).toBe(doc.version);
 await heading.click();await heading.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(true);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});await page.keyboard.insertText('Renamed ');await expect(heading).toHaveText('Renamed Target section');
 await expect.poll(async()=>(await current()).content).toContain('Renamed Target section');expect((await current()).content).toContain(`id="${anchor}"`);
 await page.goto(url+'/my-issues');await page.goto(link);const target=page.locator('.tiptap h2').filter({hasText:'Renamed Target section'});await expect(target).toHaveAttribute('id',anchor!);await expect.poll(async()=>target.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})).toBe(true);
 await page.reload();await expect(target).toHaveAttribute('id',anchor!);await expect.poll(async()=>target.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})).toBe(true);
 const blank=await(await page.request.post(url+'/api/v1/documents',{data:{title:'New headings',content:'',visibility:'workspace'}})).json();await page.goto(url+'/document/'+blank.id);const editable=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});await editable.click();await page.keyboard.insertText('/heading 2');await page.getByRole('option',{name:/^Heading 2/}).click();await page.keyboard.insertText('New heading');const added=page.locator('.tiptap h2').filter({hasText:'New heading'});await expect(added).toHaveAttribute('id',/^heading-/);const newAnchor=await added.getAttribute('id');
 const duplicated=await added.evaluate(el=>el.outerHTML);await page.keyboard.press('Enter');await editable.locator('p').last().click();await editable.evaluate((el,html)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/html',html);const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:clipboardData});el.dispatchEvent(event)},duplicated);
 await expect(page.locator('.tiptap h2')).toHaveCount(2);const ids=await page.locator('.tiptap h2').evaluateAll(els=>els.map(el=>el.id));expect(new Set(ids).size).toBe(ids.length);expect(ids).toContain(newAnchor);
 }finally{await page.close();await app.close()}
});

test('heading links reveal nested collapsed sections locally and preserve desktop handoff fragments',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.addInitScript(()=>{(window as any).__desktopLaunches=[];window.addEventListener('workspace-desktop-open',event=>{event.preventDefault();(window as any).__desktopLaunches.push((event as CustomEvent).detail.url)})});
 await page.request.post(url+'/auth/setup',{data:{name:'Section owner',email:'section@example.test',password:'section-password'}});const initial=await(await page.request.get(url+'/api/v1/state')).json();
 await page.request.patch(url+'/api/v1/users/'+initial.user.id,{data:{preferences:{...initial.user.preferences,openDesktop:true}}});
 const content='<h2>Visible overview</h2><details><summary>Outer section</summary><div data-type="detailsContent"><p>Outer body</p><details><summary>Inner section</summary><div data-type="detailsContent"><h2 data-heading-id="nested-target">Nested target</h2><p>Target body.</p></div></details></div></details>';
 const response=await page.request.post(url+'/api/v1/documents',{data:{title:'Collapsed heading link',content,visibility:'workspace'}});expect(response.ok()).toBeTruthy();const doc=await response.json(),route='/document/'+doc.id;
 const current=async()=>(await page.request.get(url+'/api/v1/documents/'+doc.id)).json();
 await page.goto(url+route);const nested=page.locator('.tiptap h2').filter({hasText:'Nested target'});await expect(nested).toBeHidden();await expect(page.getByRole('button',{name:'Copy link to Nested target',exact:true})).toHaveCount(0);
 await page.goto(url+'/my-issues');await page.goto(url+route+'#heading-nested-target');await expect(nested).toBeVisible();await expect(page.locator('.tiptap details[open]')).toHaveCount(2);await expect(page.getByRole('button',{name:'Copy link to Nested target',exact:true})).toHaveCount(1);await expect.poll(async()=>page.evaluate(()=>(window as any).__desktopLaunches)).toEqual(['parabolic://document/'+doc.id+'#heading-nested-target']);
 expect((await current()).version).toBe(doc.version);
 await page.locator('.tiptap summary').filter({hasText:'Outer section'}).click();await expect(page.locator('.tiptap details').first()).not.toHaveAttribute('open','');await expect(nested).toBeHidden();await expect(page.getByRole('button',{name:'Copy link to Nested target',exact:true})).toHaveCount(0);expect((await current()).version).toBe(doc.version);
 // An unrelated edit must not serialize the viewer-only expansion of the inner section.
 const heading=page.locator('.tiptap h2').filter({hasText:'Visible overview'});await heading.click();await page.keyboard.insertText('Edited ');await expect.poll(async()=>(await current()).content).toContain('Edited ');expect((await current()).content).not.toMatch(/<details[^>]*\bopen/);expect((await current()).version).toBe(doc.version+1);
 await page.goto(url+'/my-issues');await page.goto(url+route);await expect(nested).toBeHidden();await page.evaluate(()=>{location.hash='heading-nested-target'});await expect(nested).toBeVisible();await expect(page.locator('.tiptap details[open]')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});
