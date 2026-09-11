import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

test('two browser editors merge concurrent document edits with real cursors, history and REST restores',async({browser})=>{
  test.setTimeout(90_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
  const aliceContext=await browser.newContext(),bobContext=await browser.newContext();const errors:string[]=[];
  try{
    expect((await aliceContext.request.post(`${url}/auth/setup`,{data:{name:'Alice Editor',email:'alice@example.test',password:'Alice-editor-password',workspaceName:'Collaborative workspace'}})).ok()).toBeTruthy();
    const invitation=await(await aliceContext.request.post(`${url}/api/v1/invitations`,{data:{email:'bob@example.test',role:'member'}})).json();
    expect((await bobContext.request.post(`${url}/auth/join`,{data:{name:'Bob Editor',email:'bob@example.test',password:'Bob-editor-password',token:invitation.token}})).ok()).toBeTruthy();
    const aliceProfile=(await(await aliceContext.request.get(`${url}/auth/status`)).json()).user,bobProfile=(await(await bobContext.request.get(`${url}/auth/status`)).json()).user;await aliceContext.request.patch(`${url}/api/v1/users/${aliceProfile.id}`,{data:{username:'alice.editor'}});await bobContext.request.patch(`${url}/api/v1/users/${bobProfile.id}`,{data:{username:'bob.editor'}});
    const document=await(await aliceContext.request.post(`${url}/api/v1/documents`,{data:{title:'Concurrent browser document',content:'<p>Original paragraph</p>',visibility:'workspace'}})).json();
    const state=async()=>(await(await aliceContext.request.get(`${url}/api/v1/documents/${document.id}`)).json());
    // Hold outgoing socket packets while each real editor independently produces Yjs operations.
    for(const context of [aliceContext,bobContext])await context.addInitScript(()=>{
      const send=WebSocket.prototype.send;const held:{socket:WebSocket;data:Parameters<WebSocket['send']>[0]}[]=[];(window as any).holdCollaboration=false;
      WebSocket.prototype.send=function(data){if((window as any).holdCollaboration&&this.url.includes('/collaboration/'))held.push({socket:this,data});else send.call(this,data);};
      (window as any).releaseCollaboration=()=>{(window as any).holdCollaboration=false;for(const message of held.splice(0))send.call(message.socket,message.data);};
    });
    const alice=await aliceContext.newPage(),bob=await bobContext.newPage();for(const page of [alice,bob])page.on('pageerror',error=>errors.push(error.message));
    await Promise.all([alice.goto(`${url}/document/${document.id}`),bob.goto(`${url}/document/${document.id}`)]);
    const editor=(page:typeof alice)=>page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});
    const text=(page:typeof alice)=>editor(page).evaluate(element=>{const clone=element.cloneNode(true) as HTMLElement;clone.querySelectorAll('.collaboration-carets__caret').forEach(caret=>caret.remove());return clone.textContent;});
    await expect(editor(alice)).toContainText('Original paragraph');await expect(editor(bob)).toContainText('Original paragraph');
    await editor(alice).click();await alice.keyboard.press('Home');await editor(bob).click();await bob.keyboard.press('End');
    await expect(alice.locator('.collaboration-carets__label')).toContainText('Bob Editor');await expect(bob.locator('.collaboration-carets__label')).toContainText('Alice Editor');
    await aliceContext.request.patch(`${url}/api/v1/users/${aliceProfile.id}`,{data:{preferences:{...aliceProfile.preferences,displayNames:'Username'}}});await expect(alice.locator('.collaboration-carets__label')).toContainText('bob.editor');await expect(alice.locator('.editor-collaboration-status')).toContainText('bob.editor');await expect(bob.locator('.collaboration-carets__label')).toContainText('Alice Editor');
    await Promise.all([alice.evaluate(()=>{(window as any).holdCollaboration=true;}),bob.evaluate(()=>{(window as any).holdCollaboration=true;})]);
    await alice.keyboard.press('Home');await alice.keyboard.insertText('Alice contribution. ');await bob.keyboard.press('Home');await bob.keyboard.insertText('Bob contribution. ');
    await expect(editor(alice)).not.toContainText('Bob contribution');await expect(editor(bob)).not.toContainText('Alice contribution');
    await Promise.all([alice.evaluate(()=>(window as any).releaseCollaboration()),bob.evaluate(()=>(window as any).releaseCollaboration())]);
    for(const page of [alice,bob]){await expect(editor(page)).toContainText('Alice contribution');await expect(editor(page)).toContainText('Bob contribution');}
    expect(await text(alice)).toBe(await text(bob));await expect.poll(async()=>(await state()).content).toContain('Alice contribution');await expect.poll(async()=>(await state()).content).toContain('Bob contribution');
    await expect.poll(async()=>(await state()).history.some((entry:any)=>entry.content==='<p>Original paragraph</p>')).toBe(true);
    await alice.screenshot({path:'artifacts/platform/collaboration-alice.png'});await bob.screenshot({path:'artifacts/platform/collaboration-bob.png'});
    expect((await aliceContext.request.patch(`${url}/api/v1/documents/${document.id}`,{data:{content:'<p>Restored through the API</p>'}})).ok()).toBeTruthy();
    await expect.poll(()=>text(alice)).toBe('Restored through the API');await expect.poll(()=>text(bob)).toBe('Restored through the API');
    await bob.reload();await expect.poll(()=>text(bob)).toBe('Restored through the API');
    expect((await aliceContext.request.patch(`${url}/api/v1/documents/${document.id}`,{data:{visibility:'private'}})).ok()).toBeTruthy();
    await expect(bob.getByText('Document not found',{exact:true})).toBeVisible();expect(errors).toEqual([]);
  }finally{await aliceContext.close();await bobContext.close();await app.close();}
});

test('saved issue, project and initiative descriptions share live edits between two accounts',async({browser})=>{
  test.setTimeout(90_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();const contexts=await Promise.all([browser.newContext(),browser.newContext()]);const errors:string[]=[];
  try{
    await contexts[0].request.post(`${url}/auth/setup`,{data:{name:'Description Alice',email:'description-alice@example.test',password:'Description-alice-password',workspaceName:'Shared descriptions'}});
    const invite=await(await contexts[0].request.post(`${url}/api/v1/invitations`,{data:{email:'description-bob@example.test',role:'member'}})).json();expect((await contexts[1].request.post(`${url}/auth/join`,{data:{name:'Description Bob',email:'description-bob@example.test',password:'Description-bob-password',token:invite.token}})).ok()).toBeTruthy();
    const initial=await(await contexts[0].request.get(`${url}/api/v1/state`)).json();
    for(const context of contexts)await context.addInitScript(()=>{const original=WebSocket.prototype.send;const pending:{socket:WebSocket;data:Parameters<WebSocket['send']>[0]}[]=[];(window as any).holdEditor=false;WebSocket.prototype.send=function(data){if((window as any).holdEditor&&this.url.includes('/collaboration/'))pending.push({socket:this,data});else original.call(this,data)};(window as any).releaseEditor=()=>{(window as any).holdEditor=false;for(const message of pending.splice(0))original.call(message.socket,message.data)}});
    const pages=await Promise.all(contexts.map(context=>context.newPage()));for(const page of pages)page.on('pageerror',error=>errors.push(error.message));
    for(const [kind,route,fields] of [['issues','issues',{title:'Shared issue',teamId:initial.teams[0].id}],['projects','project',{name:'Shared project'}],['initiatives','initiative',{name:'Shared initiative'}]] as const){
      const entity=await(await contexts[0].request.post(`${url}/api/v1/${kind}`,{data:{...fields,description:'<p>Shared base</p>'}})).json();expect(entity.id).toBeTruthy();
      await Promise.all(pages.map(page=>page.goto(`${url}/${route}/${entity.id}`)));const editors=pages.map(page=>page.locator('.tiptap[contenteditable="true"]').first());for(const editor of editors)await expect(editor).toContainText('Shared base');
      await Promise.all(pages.map(page=>page.evaluate(()=>{(window as any).holdEditor=true;})));
      for(let i=0;i<pages.length;i++){await editors[i].click();await pages[i].keyboard.press('Home');await pages[i].keyboard.insertText(i===0?'Alice edit. ':'Bob edit. ');}
      await expect(editors[0]).not.toContainText('Bob edit');await expect(editors[1]).not.toContainText('Alice edit');await Promise.all(pages.map(page=>page.evaluate(()=>(window as any).releaseEditor())));
      for(const editor of editors){await expect(editor).toContainText('Alice edit');await expect(editor).toContainText('Bob edit');}
      await expect.poll(async()=>(await(await contexts[0].request.get(`${url}/api/v1/${kind}/${entity.id}`)).json()).description).toContain('Alice edit');await expect.poll(async()=>(await(await contexts[0].request.get(`${url}/api/v1/${kind}/${entity.id}`)).json()).description).toContain('Bob edit');
      await pages[0].screenshot({path:`artifacts/platform/collaboration-${kind}.png`});
    }
    expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(context=>context.close()));await app.close();}
});
