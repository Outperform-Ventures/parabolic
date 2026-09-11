import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

async function installBridge(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    const w=window as any;
    w.desktop={isDesktop:true,platform:'darwin',onCommand:()=>()=>{},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true,
      onPrepareRestart:(callback:()=>Promise<void>)=>{w.prepareRestart=callback;return()=>{delete w.prepareRestart;};}};
  });
}
test('restart waits for an active attachment upload and persists the inserted document content',async({page})=>{
  test.setTimeout(60_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),uploadStarted=new Promise<void>(resolve=>{started=resolve;});
  await installBridge(page);
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Upload restart',email:'upload-restart@example.test',password:'Upload-restart-password'}});
    const document=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Upload during restart',content:'<p>Keep the upload</p>',visibility:'workspace'}})).json();
    await page.goto(url+'/document/'+document.id);
    const editor=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});await expect(editor).toContainText('Keep the upload');
    await page.route('**/api/v1/attachments',async route=>{started();await gate;await route.continue();});
    await editor.click();await page.keyboard.press('End');
    const chooser=page.waitForEvent('filechooser');await editor.press('ControlOrMeta+Shift+u');
    await(await chooser).setFiles({name:'restart-file.txt',mimeType:'text/plain',buffer:Buffer.from('Keep these uploaded bytes')});await uploadStarted;
    await page.evaluate(()=>{const w=window as any;w.restartResult='pending';void w.prepareRestart().then(()=>{w.restartResult='saved';},()=>{w.restartResult='failed';});});
    expect(await page.evaluate(()=>(window as any).restartResult)).toBe('pending');release();
    await expect.poll(()=>page.evaluate(()=>(window as any).restartResult)).toBe('saved');
    await expect(editor.getByRole('link',{name:'restart-file.txt',exact:true})).toBeVisible();
    await page.evaluate(()=>sessionStorage.clear());await page.reload();await expect(editor.getByRole('link',{name:'restart-file.txt',exact:true})).toBeVisible();
    const href=await editor.getByRole('link',{name:'restart-file.txt',exact:true}).getAttribute('href');
    expect(await(await page.request.get(url+href)).text()).toBe('Keep these uploaded bytes');
  }finally{release();await app.close();}
});

test('issue drafts survive quota failure in memory and reach disk before restart succeeds',async({page})=>{
  test.setTimeout(60_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();await installBridge(page);
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Draft restart',email:'draft-restart@example.test',password:'Draft-restart-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json();await page.goto(url+'/team/'+state.teams[0].id+'/all');
    await page.evaluate(()=>{
      const w=window as any;w.failDraftWrites=true;const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(w.failDraftWrites&&key.startsWith('issue-drafts:'))throw new DOMException('Disk quota exceeded','QuotaExceededError');return set.call(this,key,value);};
    });
    await page.getByRole('button',{name:'Create new issue',exact:true}).click();
    await page.getByLabel('Issue title',{exact:true}).fill('Recover after quota failure');
    await page.locator('.issue-composer .tiptap').fill('Keep this unsaved draft description');
    await expect(page.getByText(/This draft could not be saved on this device/)).toBeVisible();
    const error=await page.evaluate(async()=>{try{await(window as any).prepareRestart();return null;}catch(error){return String(error);}});expect(error).toContain('could not be saved');
    await page.evaluate(async()=>{(window as any).failDraftWrites=false;await(window as any).prepareRestart();});
    await page.reload();await page.goto(url+'/drafts');
    await page.getByRole('button',{name:/^Recover after quota failure/}).click();
    await expect(page.getByLabel('Issue title',{exact:true})).toHaveValue('Recover after quota failure');
    await expect(page.locator('.issue-composer .tiptap')).toContainText('Keep this unsaved draft description');
  }finally{await app.close();}
});

test('restart acknowledgement includes an upload that just changed an issue creation draft',async({page})=>{
  test.setTimeout(60_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();await installBridge(page);
  let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),began=new Promise<void>(resolve=>{started=resolve;});
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Draft upload',email:'draft-upload@example.test',password:'Draft-upload-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json();await page.goto(url+'/team/'+state.teams[0].id+'/all');
    await page.getByRole('button',{name:'Create new issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).fill('Draft with pending upload');
    const editor=page.locator('.issue-composer .tiptap');await editor.click();
    await page.route('**/api/v1/attachments',async route=>{started();await gate;await route.continue();});
    const chooser=page.waitForEvent('filechooser');await editor.press('ControlOrMeta+Shift+u');await(await chooser).setFiles({name:'draft-restart.txt',mimeType:'text/plain',buffer:Buffer.from('Draft attachment')});await began;
    await page.evaluate(()=>{
      const w=window as any;w.draftAtRestart=null;
      void w.prepareRestart().then(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('issue-drafts:'))!;w.draftAtRestart=JSON.parse(localStorage.getItem(key)??'[]').find((draft:any)=>draft.fields.title==='Draft with pending upload')?.fields.description??'';});
    });
    release();await expect.poll(()=>page.evaluate(()=>(window as any).draftAtRestart)).not.toBeNull();
    expect(await page.evaluate(()=>(window as any).draftAtRestart)).toContain('draft-restart.txt');
  }finally{release();await app.close();}
});

test('draft recovery retains another window draft when a failed local write is retried',async({page,context})=>{
  test.setTimeout(60_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();await installBridge(page);
  const other=await context.newPage();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Two-window drafts',email:'two-drafts@example.test',password:'Two-window-drafts-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json(),route=url+'/team/'+state.teams[0].id+'/all';await page.goto(route);
    await page.evaluate(()=>{const w=window as any;w.failDraftWrites=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(w.failDraftWrites&&key.startsWith('issue-drafts:'))throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};});
    await page.getByRole('button',{name:'Create new issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).fill('First window pending draft');
    await expect(page.getByText(/This draft could not be saved on this device/)).toBeVisible();
    await other.goto(route);await other.getByRole('button',{name:'Create new issue',exact:true}).click();await other.getByLabel('Issue title',{exact:true}).fill('Second window saved draft');
    await expect.poll(()=>other.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('issue-drafts:'));return key?localStorage.getItem(key):'';})).toContain('Second window saved draft');
    await page.evaluate(async()=>{(window as any).failDraftWrites=false;await(window as any).prepareRestart();});
    await page.reload();await page.goto(url+'/drafts');
    await expect(page.getByRole('button',{name:/^First window pending draft/})).toBeVisible();
    await expect(page.getByRole('button',{name:/^Second window saved draft/})).toBeVisible();
  }finally{await other.close();await app.close();}
});
