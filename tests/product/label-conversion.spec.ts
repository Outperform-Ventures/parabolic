import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';

for(const entityType of ['issues','projects'])test(`${entityType} label conversion persists through settings and preserves identity`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Conversion owner',email:'conversion-ui@example.test',password:'owner-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json();
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const label=await create('labels',{name:'Convertible label',entityType,description:'Keep description',color:'#ee8844'});
 if(entityType==='issues'){
  await page.goto(url+'/label/'+label.id);await page.getByRole('button',{name:'Favorite view',exact:true}).click();
  // Establish the favorite before hard navigation: conversion must preserve a
  // saved record, not race destruction of the preceding page's pending write.
  await expect(page.getByRole('button',{name:'Unfavorite view',exact:true})).toBeVisible();
  await expect.poll(()=>app.repo.all('favorites',state.workspaceId).some(f=>f.entityId===label.id)).toBe(true);
 }
 await page.goto(url+'/settings/labels');const row=page.locator(`[data-label-id="${label.id}"]`);await row.click({button:'right'});await page.getByRole('menuitem',{name:'Convert to label group',exact:true}).click();
 const group=page.locator(`[data-label-group-id="${label.id}"]`);await expect(group).toContainText('0 labels');await expect(row).toHaveCount(0);await page.reload();await expect(group).toBeVisible();
 expect(app.repo.raw('labelGroups',label.id)).toMatchObject({id:label.id,name:label.name,description:label.description,color:label.color,entityType});
 if(entityType==='issues'){
  const child=await create('labels',{name:'Child',entityType,labelGroupId:label.id});await create('issues',{title:'Inside converted group',teamId:state.teams[0].id,labelIds:[child.id]});
  await expect(group.getByRole('button',{name:'Convert to label',exact:true})).toHaveCount(0);
  await page.goto(url+'/label/'+label.id);await expect(page.locator('.page-header h1')).toHaveText(label.name);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Inside converted group');
  await expect(page.locator('.sidebar').getByRole('link',{name:label.name,exact:true})).toBeVisible();
  expect((await page.request.delete(url+'/api/v1/labels/'+child.id)).ok()).toBeTruthy();await page.goto(url+'/settings/labels');
 }
 await group.getByRole('button',{name:'Convert to label',exact:true}).click();await expect(row).toBeVisible();await expect(group).toHaveCount(0);await page.reload();await expect(row).toBeVisible();expect(app.repo.raw('labels',label.id)).toMatchObject({description:label.description,color:label.color,entityType});
 if(entityType==='issues'){
  await create('issues',{title:'Restored label assignment',teamId:state.teams[0].id,labelIds:[label.id]});await page.goto(url+'/label-group/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Restored label assignment');
  await page.goto(url+'/settings/labels');await row.click({button:'right'});await expect(page.getByRole('menuitem',{name:'Convert to label group',exact:true})).toHaveCount(0);
 }
 }finally{await page.close();await app.close()}
});

test('offline conversion round trips survive reload and synchronize in order',async({page,context,browserName})=>{
 test.setTimeout(90000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let disconnected=false;const listeners=app.server.listeners('request');
 if(browserName==='webkit'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(disconnected)request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)})}
 const offline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections()}else await context.setOffline(value)};
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Offline conversion',email:'offline-conversion@example.test',password:'owner-password'}});
 const label=await(await page.request.post(url+'/api/v1/labels',{data:{name:'Offline convertible'}})).json();
 await page.goto(url+'/settings/labels');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline(true);const row=page.locator(`[data-label-id="${label.id}"]`),group=page.locator(`[data-label-group-id="${label.id}"]`);
 await row.click({button:'right'});await page.getByRole('menuitem',{name:'Convert to label group',exact:true}).click();await expect(group).toBeVisible();await expect(row).toHaveCount(0);
 await page.reload({waitUntil:'domcontentloaded'});await expect(group).toBeVisible();expect(app.repo.raw('labelGroups',label.id)).toBeNull();
 await group.getByRole('button',{name:'Convert to label',exact:true}).click();await expect(row).toBeVisible();await page.reload({waitUntil:'domcontentloaded'});await expect(row).toBeVisible();
 await offline(false);await expect.poll(()=>app.repo.raw('labels',label.id)?.version).toBe(3);expect(app.repo.raw('labelGroups',label.id)).toBeNull();
 await page.reload();await expect(row).toBeVisible();await expect(group).toHaveCount(0);
 }finally{await offline(false);await page.close();await app.close()}
});

for(const resolution of ['retry','discard'])test(`conversion rejected by a remote assignment survives reload and supports ${resolution}`,async({page,context,browserName})=>{
 test.setTimeout(90000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let disconnected=false;const listeners=app.server.listeners('request');
 if(browserName==='webkit'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(disconnected)request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)})}
 const offline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections()}else await context.setOffline(value)};
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Conversion conflict',email:'conversion-conflict@example.test',password:'owner-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
 const label=app.repo.create(actor,'labels',{name:'Concurrent convertible'});
 await page.goto(url+'/settings/labels');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline(true);const row=page.locator(`[data-label-id="${label.id}"]`),group=page.locator(`[data-label-group-id="${label.id}"]`);
 await row.click({button:'right'});await page.getByRole('menuitem',{name:'Convert to label group',exact:true}).click();await expect(group).toBeVisible();
 const issue=app.repo.create(actor,'issues',{title:'Remote assignment',teamId:state.teams[0].id,labelIds:[label.id]});
 await offline(false);await page.getByRole('button',{name:'Review unsent changes',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Review unsent change',exact:true});await expect(dialog.getByRole('alert')).toContainText('Remove label assignments');
 expect(app.repo.raw('labels',label.id)).not.toBeNull();expect(app.repo.raw('labelGroups',label.id)).toBeNull();expect(app.repo.raw('issues',issue.id)?.labelIds).toEqual([label.id]);
 await page.reload();await page.getByRole('button',{name:'Review unsent changes',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Remove label assignments');
 if(resolution==='retry'){
  app.repo.update(actor,'issues',issue.id,{labelIds:[]});await dialog.getByRole('button',{name:'Try again',exact:true}).click();await expect.poll(()=>app.repo.raw('labelGroups',label.id)?.name).toBe(label.name);await expect(group).toBeVisible();await expect(row).toHaveCount(0);
 }else{
  await dialog.getByRole('button',{name:'Discard change',exact:true}).click();await dialog.getByRole('button',{name:'Confirm discard',exact:true}).click();await expect(row).toBeVisible();await expect(group).toHaveCount(0);expect(app.repo.raw('issues',issue.id)?.labelIds).toEqual([label.id]);
 }
 await expect(page.getByRole('button',{name:'Review unsent changes',exact:true})).toHaveCount(0);await page.reload();await expect(resolution==='retry'?group:row).toBeVisible();
 }finally{await offline(false);await page.close();await app.close()}
});

test('a queued reverse conversion waits for its rejected forward conversion to be resolved',async({page,context,browserName})=>{
 test.setTimeout(90000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let disconnected=false;const listeners=app.server.listeners('request');
 if(browserName==='webkit'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(disconnected)request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)})}
 const offline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections()}else await context.setOffline(value)};
 let reverseRequests=0;page.on('request',request=>{if(request.url()===url+'/api/v1/batch'&&request.method()==='POST'){const body=request.postDataJSON();if(body.operations?.some((op:any)=>op.kind==='labelGroups'&&op.data?.convertTo==='labels'))reverseRequests++;}});
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Dependent conversion',email:'dependent-conversion@example.test',password:'owner-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
 const label=app.repo.create(actor,'labels',{name:'Dependent label'});
 await page.goto(url+'/settings/labels');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline(true);const row=page.locator(`[data-label-id="${label.id}"]`),group=page.locator(`[data-label-group-id="${label.id}"]`);
 await row.click({button:'right'});await page.getByRole('menuitem',{name:'Convert to label group',exact:true}).click();await group.getByRole('button',{name:'Convert to label',exact:true}).click();await expect(row).toBeVisible();await page.reload({waitUntil:'domcontentloaded'});await expect(row).toBeVisible();
 const issue=app.repo.create(actor,'issues',{title:'Concurrent assignment',teamId:state.teams[0].id,labelIds:[label.id]});
 reverseRequests=0;await offline(false);await page.getByRole('button',{name:'Review unsent changes',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Review unsent change',exact:true});await expect(dialog.getByRole('alert')).toContainText('Remove label assignments');
 // An unrelated mutation provides a flush-order sentinel after the failed conversion.
 await dialog.getByRole('button',{name:'Review later',exact:true}).click();await page.getByRole('button',{name:'New group',exact:true}).click();await page.getByLabel('Group name',{exact:true}).fill('Unrelated sentinel');await page.getByLabel('Group name',{exact:true}).press('Enter');await expect.poll(()=>app.repo.all('labelGroups',actor.workspaceId).some(g=>g.name==='Unrelated sentinel')).toBe(true);
 expect(reverseRequests).toBe(0);
 app.repo.update(actor,'issues',issue.id,{labelIds:[]});await page.getByRole('button',{name:'Review unsent changes',exact:true}).click();await dialog.getByRole('button',{name:'Try again',exact:true}).click();await expect.poll(()=>app.repo.raw('labels',label.id)?.version).toBe(3);await expect(page.getByRole('button',{name:'Review unsent changes',exact:true})).toHaveCount(0);expect(reverseRequests).toBe(1);await page.reload();await expect(row).toBeVisible();await expect(group).toHaveCount(0);
 }finally{await offline(false);await page.close();await app.close()}
});
