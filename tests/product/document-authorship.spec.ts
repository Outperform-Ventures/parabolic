import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('document author names show authenticated mixed authors and toggle through display options and commands without saving edits',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Original Writer',email:'author@example.test',password:'authors-password'}});
  const invite=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'colleague@example.test',role:'member'}})).json();
  await member.request.post(url+'/auth/join',{data:{name:'Second Writer',email:'colleague@example.test',password:'authors-password',token:invite.token}});
  const doc=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Authors review',content:'<p>Original sentence.</p><p>Another original paragraph.</p>',visibility:'workspace'}})).json();
  const current=async()=>(await page.request.get(url+'/api/v1/documents/'+doc.id)).json();
  await page.goto(url+'/document/'+doc.id);await expect(page.locator('.tiptap p').first()).toHaveText('Original sentence.');
  await page.getByRole('button',{name:'Document display options',exact:true}).click();await page.getByRole('menuitem',{name:'Show author names',exact:true}).click();
  await expect(page.locator('.editor-author-name')).toHaveText(['Original Writer','Original Writer']);expect((await current()).version).toBe(doc.version);
  await member.request.patch(url+'/api/v1/documents/'+doc.id,{data:{content:'<p>Original sentence. Added by colleague.</p><p>Another original paragraph.</p><p>Colleague paragraph.</p>'}});
  await expect(page.locator('.tiptap p').first()).toContainText('Added by colleague.');
  await expect(page.locator('.editor-author-name')).toHaveText(['Original Writer, Second Writer','Original Writer','Second Writer']);
  const updated=await current();
  await page.keyboard.press('ControlOrMeta+k');await page.getByRole('textbox',{name:'Command menu',exact:true}).fill('Hide author names');await page.keyboard.press('Enter');await expect(page.locator('.editor-author-name')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+k');await page.getByRole('textbox',{name:'Command menu',exact:true}).fill('Show author names');await page.keyboard.press('Enter');await expect(page.locator('.editor-author-name')).toHaveCount(3);
  await page.reload();await expect(page.locator('.tiptap p').first()).toContainText('Added by colleague.');await page.getByRole('button',{name:'Document display options',exact:true}).click();await page.getByRole('menuitem',{name:'Show author names',exact:true}).click();await expect(page.locator('.editor-author-name')).toHaveText(['Original Writer, Second Writer','Original Writer','Second Writer']);expect((await current()).version).toBe(updated.version);
  await page.screenshot({path:'artifacts/verification/document-authorship-'+test.info().project.name+'.png'});
 }finally{await member.close();await page.close();await app.close()}
});

test('author labels cover inline dates and collapsed summaries without overlapping table cells',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Block Owner',email:'blocks@example.test',password:'authors-password'}});
  const invite=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'block-colleague@example.test',role:'member'}})).json();await member.request.post(url+'/auth/join',{data:{name:'Block Colleague',email:'block-colleague@example.test',password:'authors-password',token:invite.token}});
  const html='<table><tbody><tr><td><p>Left cell.</p></td><td><p>Right cell.</p></td></tr></tbody></table><details><summary>Collapsed heading</summary><div data-type="detailsContent"><p>Hidden paragraph.</p></div></details><ul><li><p>First item.</p></li><li><p>Second item.</p></li></ul><p><span data-date="2026-09-06">Sep 6</span></p>';
  const doc=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Rich authors',content:html,visibility:'workspace'}})).json();await member.request.patch(url+'/api/v1/documents/'+doc.id,{data:{content:html.replace('Right cell.','Colleague cell.').replace('Second item.','Colleague list item.')}});
  await page.goto(url+'/document/'+doc.id);const editor=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});await expect(editor.locator('td').last()).toHaveText('Colleague cell.');await page.getByRole('button',{name:'Document display options',exact:true}).click();await page.getByRole('menuitem',{name:'Show author names',exact:true}).click();
  const labels=page.locator('.editor-author-name');await expect(labels).toHaveText(['Block Owner, Block Colleague','Block Owner','Block Owner','Block Colleague, Block Owner','Block Owner']);
  const separated=()=>labels.evaluateAll(els=>{const boxes=els.map(el=>el.getBoundingClientRect());return boxes.every((box,i)=>!i||box.top>=boxes[i-1].bottom-.1)});expect(await separated()).toBe(true);
  await expect(editor.getByText('Hidden paragraph.',{exact:true})).not.toBeVisible();await editor.locator('summary').click();await expect(editor.getByText('Hidden paragraph.',{exact:true})).toBeVisible();await expect(labels).toHaveCount(6);expect(await separated()).toBe(true);
  await editor.locator('summary').click();await expect(editor.getByText('Hidden paragraph.',{exact:true})).not.toBeVisible();await expect(labels).toHaveCount(5);
  await page.setViewportSize({width:900,height:800});await expect.poll(separated).toBe(true);await expect(labels).toHaveCount(5);
  await page.screenshot({path:'artifacts/verification/document-authorship-blocks-'+(test.info().project.name||'chromium')+'.png'});
 }finally{await member.close();await page.close();await app.close()}
});

test('cached author names survive offline reloads and refresh after offline and remote edits merge',async({page,browser})=>{
 test.setTimeout(120000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext(),sockets=new Set<import('node:stream').Duplex>();let offline=false;const editor=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});
 // Make the service actually unreachable, including upgraded sockets. This
 // lets the real service worker serve reloads on all three browser engines.
 const requests=app.server.listeners('request'),upgrades=app.server.listeners('upgrade');app.server.removeAllListeners('request');app.server.removeAllListeners('upgrade');
 app.server.on('request',(req,res)=>{if(offline)req.socket.destroy();else for(const listener of requests)listener.call(app.server,req,res)});
 app.server.on('upgrade',(req,socket,head)=>{if(offline){socket.destroy();return}sockets.add(socket);socket.once('close',()=>sockets.delete(socket));for(const listener of upgrades)listener.call(app.server,req,socket,head)});
 const disconnect=()=>{offline=true;app.server.closeAllConnections();for(const socket of sockets)socket.destroy()};
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Offline Writer',email:'offline-author@example.test',password:'authors-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),invite=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'remote-author@example.test',role:'member'}})).json();
  await member.request.post(url+'/auth/join',{data:{name:'Remote Writer',email:'remote-author@example.test',password:'authors-password',token:invite.token}});
  const memberState=await(await member.request.get(url+'/api/v1/state')).json();
  const doc=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Offline authors',content:'<p>Original content.</p>',visibility:'workspace'}})).json();
  await member.request.patch(url+'/api/v1/documents/'+doc.id,{data:{content:'<p>Original content.</p><p>Remote contribution.</p>'}});
  await page.goto(url+'/document/'+doc.id);await expect(editor.locator('p').last()).toHaveText('Remote contribution.');
  const show=async()=>{await page.getByRole('button',{name:'Document display options',exact:true}).click();await page.getByRole('menuitem',{name:'Show author names',exact:true}).click()};
  await show();await expect(page.locator('.editor-author-name')).toHaveText(['Offline Writer','Remote Writer']);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const database=`parabolic:collaboration:${url}:${state.workspaceId}:${state.user.id}:${doc.id}`;
  const cachedAuthors=()=>page.evaluate(name=>new Promise<string[]>((resolve,reject)=>{const request=indexedDB.open(name);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('custom','readonly'),rows=tx.objectStore('custom').getAll();tx.oncomplete=()=>{db.close();resolve(rows.result.filter(value=>value&&typeof value==='object'&&'userId'in value).map(value=>value.userId).sort())};tx.onabort=()=>{db.close();reject(tx.error)}}}),database);
  await expect.poll(cachedAuthors).toEqual(expect.arrayContaining([state.user.id,memberState.user.id]));
  disconnect();await page.reload({waitUntil:'domcontentloaded'});await expect(editor.locator('p').last()).toHaveText('Remote contribution.');await show();await expect(page.locator('.editor-author-name')).toHaveText(['Offline Writer','Remote Writer']);
  // Keep a real transaction ahead of the editor's writes, making the reload
  // happen while those writes are pending instead of depending on timing.
  await page.evaluate(name=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open(name);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('updates','readwrite'),store=tx.objectStore('updates');const keepAlive=()=>{const read=store.get(0);read.onsuccess=keepAlive};keepAlive();resolve()}}),database);
  await editor.locator('p').last().evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);(el.closest('[contenteditable]') as HTMLElement).focus()});await page.keyboard.press('Enter');await page.keyboard.insertText('Offline addition.');await expect(editor.locator('p').last()).toHaveText('Offline addition.');expect(await page.evaluate(key=>sessionStorage.getItem(key),database+':pending')).toBeTruthy();
  await page.reload({waitUntil:'domcontentloaded'});await expect(editor.locator('p').last()).toHaveText('Offline addition.');await show();await expect(page.locator('.editor-author-name')).toHaveText(['Offline Writer','Remote Writer','Unknown author']);
  const actor=app.repo.actorForUser(memberState.user.id,state.workspaceId,['read','write']);app.repo.update(actor,'documents',doc.id,{content:'<p>Original content.</p><p>Remote contribution.</p><p>Remote addition.</p>'});
  offline=false;
  await expect.poll(()=>app.repo.raw('documents',doc.id)?.content).toContain('Offline addition.');await expect(editor).toContainText('Remote addition.');
  await expect.poll(()=>page.locator('.editor-author-name').allTextContents()).toEqual(expect.arrayContaining(['Offline Writer','Remote Writer']));await expect(page.locator('.editor-author-name')).toHaveCount(4);await expect(page.locator('.editor-author-name').filter({hasText:'Unknown author'})).toHaveCount(0);
  const mergedVersion=app.repo.raw('documents',doc.id)!.version;
  // Reopening offline again must use the authoritative metadata from reconnect.
  await page.reload();await expect(editor).toContainText('Offline addition.');await show();await expect(page.locator('.editor-author-name').filter({hasText:'Unknown author'})).toHaveCount(0);disconnect();await page.reload({waitUntil:'domcontentloaded'});await expect(editor).toContainText('Offline addition.');await show();await expect(page.locator('.editor-author-name')).toHaveCount(4);await expect(page.locator('.editor-author-name').filter({hasText:'Unknown author'})).toHaveCount(0);expect(app.repo.raw('documents',doc.id)!.version).toBe(mergedVersion);
 }finally{offline=false;await member.close();await page.close();for(const socket of sockets)socket.destroy();await app.close()}
});
