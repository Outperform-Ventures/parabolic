import {test, expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('shared forms freeze pending submissions and restore edits after a failed save',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  let release!:()=>void,entered!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{entered=resolve;});let attempts=0;
  await page.addInitScript(()=>{
    const target=window as any;
    target.desktop={isDesktop:true,platform:'darwin',onCommand:()=>()=>{},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true,
      onPrepareRestart:(callback:()=>Promise<void>)=>{target.prepareRestart=callback;return()=>{delete target.prepareRestart;};}};
  });
  try{
    expect((await page.request.post(url+'/auth/setup',{data:{name:'Save owner',email:'save-owner@example.test',password:'Save-owner-password'}})).ok()).toBeTruthy();
    await page.route('**/api/v1/apps',async route=>{
      if(route.request().method()!=='POST'||attempts++)return route.continue();
      entered();await held;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Application save unavailable'}})});
    });
    await page.goto(url+'/settings/applications');await page.getByRole('button',{name:'New application',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'New application',exact:true}),name=dialog.getByLabel('Application name',{exact:true});
    await name.fill('Submitted application');await dialog.getByLabel('Enable client credentials',{exact:true}).check();
    await dialog.getByRole('button',{name:'Create',exact:true}).click();await requested;
    expect(await page.locator('dialog[open] form').evaluate(element=>(element as HTMLElement).inert)).toBe(true);
    await page.locator('input[aria-label="Application name"]').evaluate(element=>(element as HTMLElement).focus());await page.keyboard.insertText('Unexpected later edit');
    expect(await page.locator('input[aria-label="Application name"]').inputValue()).toBe('Submitted application');
    await page.evaluate(()=>{const w=window as any;w.restartResult='pending';void w.prepareRestart().then(()=>{w.restartResult='ready';},(error:unknown)=>{w.restartResult=String(error);});});
    expect(await page.evaluate(()=>(window as any).restartResult)).toBe('pending');release();
    await expect(dialog.getByRole('alert')).toContainText('Application save unavailable');
    expect(await dialog.locator('form').evaluate(element=>(element as HTMLElement).inert)).toBe(false);
    await expect.poll(()=>page.evaluate(()=>(window as any).restartResult)).toContain('could not be saved');
    await name.fill('Retried application');await dialog.getByRole('button',{name:'Create',exact:true}).click();
    const secret=page.getByRole('dialog',{name:'Save your credential',exact:true});await expect(secret).toBeVisible();await secret.getByRole('button',{name:'Done',exact:true}).click();
    const applications=(await(await page.request.get(url+'/api/v1/apps')).json()).nodes;expect(applications).toHaveLength(1);expect(applications[0].name).toBe('Retried application');
    await page.evaluate(async()=>{await(window as any).prepareRestart();});
  }finally{release();await app.close();}
});

test('restart distinguishes picker searches from selections and catches formatting-only form edits',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  await page.addInitScript(()=>{
    const target=window as any;
    target.desktop={isDesktop:true,platform:'darwin',onCommand:()=>()=>{},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true,
      onPrepareRestart:(callback:()=>Promise<void>)=>{target.prepareRestart=callback;return()=>{delete target.prepareRestart;};}};
  });
  const prepare=()=>page.evaluate(async()=>{try{await(window as any).prepareRestart();return 'ready';}catch(error){return String(error)+(error instanceof AggregateError?' '+error.errors.map(String).join('; '):'');}});
  try{
    expect((await page.request.post(url+'/auth/setup',{data:{name:'Custom form owner',email:'custom-form@example.test',password:'Custom-form-password'}})).ok()).toBeTruthy();
    const state=await(await page.request.get(url+'/api/v1/state')).json();
    await page.goto(url+'/settings/applications');await page.getByRole('button',{name:'New application',exact:true}).click();
    const form=page.getByRole('dialog',{name:'New application',exact:true});
    await form.getByRole('button',{name:'Additional teams',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'Change Additional teams',exact:true});
    await picker.getByRole('combobox').fill(state.teams[0].name);expect(await prepare()).toBe('ready');
    await picker.getByRole('option',{name:state.teams[0].name,exact:true}).click();
    expect(await prepare()).toContain('could not be saved');await page.keyboard.press('Escape');
    await form.getByRole('button',{name:'Cancel',exact:true}).click();expect(await prepare()).toBe('ready');
    const create=async(kind:string,data:object)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json();};
    const customer=await create('customers',{name:'Formatting customer'}),issue=await create('issues',{title:'Formatting issue',teamId:state.teams[0].id});
    const request=await create('requests',{title:'Format this request',customerId:customer.id,issueId:issue.id,body:'<p>Existing request details</p>'});
    await page.goto(url+'/customer/'+customer.id);await page.getByRole('button',{name:'Format this request',exact:true}).click();
    const editing=page.getByRole('dialog',{name:'Edit customer request',exact:true}),editor=editing.locator('[contenteditable=true]');
    await expect(editor).toContainText('Existing request details');expect(await prepare()).toBe('ready');
    await editor.locator('p').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);(element.closest('[contenteditable=true]') as HTMLElement).focus();document.dispatchEvent(new Event('selectionchange'));});
    await page.getByRole('toolbar',{name:'Text formatting',exact:true}).getByRole('button',{name:'Bold',exact:true}).click();
    await expect(editor.locator('strong')).toHaveText('Existing request details');expect(await prepare()).toContain('could not be saved');
    await page.getByRole('toolbar',{name:'Text formatting',exact:true}).getByRole('button',{name:'More formatting',exact:true}).click();
    await page.getByRole('menu',{name:'Formatting options',exact:true}).getByRole('menuitem',{name:'Align right',exact:true}).click();
    await expect(editor.locator('p')).toHaveCSS('text-align','right');
    await editing.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editing).toHaveCount(0);expect(await prepare()).toBe('ready');
    expect((await(await page.request.get(url+'/api/v1/requests/'+request.id)).json()).body).toContain('<strong>Existing request details</strong>');
  }finally{await app.close();}
});

test('desktop restart blocks unsaved shared form fields and allows saved or explicitly closed forms',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  await page.addInitScript(()=>{
    const target=window as any;
    target.desktop={isDesktop:true,platform:'darwin',onCommand:()=>()=>{},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true,
      onPrepareRestart:(callback:()=>Promise<void>)=>{target.prepareRestart=callback;return()=>{delete target.prepareRestart;};}};
  });
  const prepare=()=>page.evaluate(async()=>{try{await(window as any).prepareRestart();return 'ready';}catch(error){return String(error);}});
  try{
    expect((await page.request.post(url+'/auth/setup',{data:{name:'Form owner',email:'form-restart@example.test',password:'Form-restart-password'}})).ok()).toBeTruthy();
    await page.goto(url+'/documents?new=1');
    const dialog=page.getByRole('dialog',{name:'New document',exact:true});
    await expect(dialog).toBeVisible();expect(await prepare()).toBe('ready');
    await dialog.getByLabel('Sharing',{exact:true}).selectOption('private');
    expect(await prepare()).toContain('could not be saved');
    await dialog.getByLabel('Title',{exact:true}).fill('Restart form preservation');
    expect(await prepare()).toContain('could not be saved');
    await expect(dialog.getByLabel('Title',{exact:true})).toHaveValue('Restart form preservation');
    await dialog.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByLabel('Document title',{exact:true})).toHaveValue('Restart form preservation');
    expect(await prepare()).toBe('ready');await page.reload();
    await expect(page.getByLabel('Document title',{exact:true})).toHaveValue('Restart form preservation');
    await page.goto(url+'/documents?new=1');await expect(dialog).toBeVisible();
    await dialog.getByLabel('Title',{exact:true}).fill('Explicitly discarded');
    expect(await prepare()).toContain('could not be saved');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
    expect(await prepare()).toBe('ready');
  }finally{await app.close();}
});

test('desktop restart waits for collaborative editor durability and rejects a failed disk write', async ({page}) => {
  test.setTimeout(60_000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const target=window as any;
    target.desktop={isDesktop:true,platform:'darwin',onCommand:()=>()=>{},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true,
      onPrepareRestart:(callback:()=>Promise<void>)=>{target.prepareRestart=callback;return()=>{delete target.prepareRestart;};}};
    const send=WebSocket.prototype.send;
    WebSocket.prototype.send=function(data){if(this.url.includes('/collaboration/')&&localStorage.getItem('test-hold-collaboration')==='true')return;send.call(this,data);};
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode,options){
      if(target.failRestartWrite&&mode==='readwrite'&&this.name.startsWith('parabolic:collaboration:'))throw new DOMException('Simulated disk quota failure','QuotaExceededError');
      return transaction.call(this,stores,mode,options);
    };
  });
  try{
    expect((await page.request.post(url+'/auth/setup',{data:{name:'Restart owner',email:'restart@example.test',password:'Restart-owner-password'}})).ok()).toBeTruthy();
    const document=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Restart durability',content:'<p>Original text</p>',visibility:'workspace'}})).json();
    await page.goto(url+'/document/'+document.id);
    const editor=page.getByRole('textbox',{name:'Start writing, or type / for commands…',exact:true});
    await expect(editor).toContainText('Original text');
    await page.evaluate(()=>localStorage.setItem('test-hold-collaboration','true'));
    await editor.click();await page.keyboard.press('End');await page.keyboard.insertText(' Unsynced restart text');
    await expect(editor).toContainText('Unsynced restart text');
    expect((await(await page.request.get(url+'/api/v1/documents/'+document.id)).json()).content).not.toContain('Unsynced restart text');
    const failure=await page.evaluate(async()=>{const w=window as any;w.failRestartWrite=true;try{await w.prepareRestart();return null;}catch(error){return String(error);}});
    expect(failure).toContain('could not be saved');await expect(editor).toContainText('Unsynced restart text');
    await page.evaluate(async()=>{const w=window as any;w.failRestartWrite=false;await w.prepareRestart();sessionStorage.clear();});
    await page.reload();await expect(editor).toContainText('Unsynced restart text');
    expect((await(await page.request.get(url+'/api/v1/documents/'+document.id)).json()).content).not.toContain('Unsynced restart text');
    expect(errors).toEqual([]);
  }finally{await app.close();}
});
