import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('entity menus copy canonical links from lists and detail tabs',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedLink=text}}}));
  await page.request.post(url+'/auth/setup',{data:{name:'Link Owner',email:'entity-links@example.test',password:'entity-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};
  const view=await create('views',{name:'Linked view',entityType:'projects',layout:'List'}),initiative=await create('initiatives',{name:'Linked initiative'}),customer=await create('customers',{name:'Linked customer'}),dashboard=await create('dashboards',{name:'Linked dashboard',widgets:[]}),form=await create('asksForms',{name:'Linked request form',teamId:state.teams[0].id,enabled:true,fields:[]});
  const cases=[
   {start:'/views',target:'/view/'+view.id,title:view.name,row:'.feature-linked-row'},
   {start:'/initiative/'+initiative.id+'/projects?from=list#unused',target:'/initiative/'+initiative.id,title:initiative.name},
   {start:'/customer/'+customer.id+'?from=list#unused',target:'/customer/'+customer.id,title:customer.name},
   {start:'/dashboards/'+dashboard.id+'?from=list#unused',target:'/dashboards/'+dashboard.id,title:dashboard.name},
   {start:'/asks',target:'/request/'+form.id,title:form.name,row:'.feature-settings-row'},
  ];
  for(const entry of cases){
   await page.goto(url+entry.start);const scope=entry.row?page.locator(entry.row).filter({hasText:entry.title}):page.locator('.feature-header');await expect(scope).toContainText(entry.title);await scope.getByRole('button',{name:'More actions',exact:true}).click();await page.locator('.feature-menu').getByRole('button',{name:'Copy link',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedLink)).toBe(url+entry.target);
   await page.goto(url+entry.target);await expect(entry.row==='.feature-settings-row'?page.getByRole('heading',{name:entry.title,exact:true}):page.locator('.feature-header').first()).toContainText(entry.title);await page.reload();await expect(entry.row==='.feature-settings-row'?page.getByRole('heading',{name:entry.title,exact:true}):page.locator('.feature-header').first()).toContainText(entry.title);
  }
 }finally{await page.close();await app.close()}
});

test('customer request links resolve their current context and focus the request without exposing private work',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext();
 try{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedLink=text}}}));
  await page.request.post(url+'/auth/setup',{data:{name:'Request Owner',email:'request-links@example.test',password:'request-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};
  const invitation=await create('invitations',{email:'request-reader@example.test',role:'member'});expect((await member.request.post(url+'/auth/join',{data:{name:'Request Reader',email:'request-reader@example.test',password:'request-password',token:invitation.token}})).ok()).toBeTruthy();
  const customer=await create('customers',{name:'Request customer'}),issue=await create('issues',{title:'Request issue',teamId:state.teams[0].id}),project=await create('projects',{name:'Request project',teamIds:[state.teams[0].id]}),request=await create('requests',{title:'Specific feedback',body:'<p>Customer feedback detail.</p>',customerId:customer.id,issueId:issue.id});
  const link=url+'/customer-request/'+request.id,anchor='#customerRequest-'+request.id,selector=`[data-request-id="${request.id}"]`;
  await page.goto(url+'/customer/'+customer.id);await page.locator(selector).getByRole('button',{name:'More actions',exact:true}).click();await page.locator('.feature-menu').getByRole('button',{name:'Copy link',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedLink)).toBe(link);
  const verify=async(path:string)=>{await page.goto(link);await expect(page).toHaveURL(url+path+anchor);await expect(page.locator(selector)).toBeFocused();await expect(page.locator(selector)).toContainText('Customer feedback detail.');await page.reload();await expect(page.locator(selector)).toBeFocused()};
  await verify('/issues/'+issue.id);
  expect((await page.request.patch(url+'/api/v1/requests/'+request.id,{data:{issueId:null,projectId:project.id}})).ok()).toBeTruthy();await verify('/project/'+project.id+'/customer-requests');
  expect((await page.request.patch(url+'/api/v1/requests/'+request.id,{data:{projectId:null}})).ok()).toBeTruthy();await verify('/customer/'+customer.id);
  const team=await create('teams',{name:'Restricted request context',key:'RRC',private:true}),privateIssue=await create('issues',{title:'Private request work',teamId:team.id});expect((await page.request.patch(url+'/api/v1/requests/'+request.id,{data:{issueId:privateIssue.id}})).ok()).toBeTruthy();const reader=await member.newPage();await reader.goto(link);await expect(reader.getByText('Customer request not found',{exact:true})).toBeVisible();await expect(reader.getByText('Specific feedback',{exact:true})).toHaveCount(0);
  expect((await page.request.patch(url+'/api/v1/requests/'+request.id,{data:{issueId:null,customerId:null}})).ok()).toBeTruthy();await page.goto(link);await expect(page.locator(selector)).toContainText(request.title);await expect(page).toHaveURL(link);
  expect((await page.request.delete(url+'/api/v1/requests/'+request.id)).ok()).toBeTruthy();await page.reload();await expect(page.getByText('Customer request not found',{exact:true})).toBeVisible();
 }finally{await member.close();await page.close();await app.close()}
});

test('template links open the selected editor, survive rename and reload, and handle unavailable templates',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext();
 try{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedLink=text}}}));
  await page.request.post(url+'/auth/setup',{data:{name:'Template Owner',email:'template-links@example.test',password:'template-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};
  const invitation=await create('invitations',{email:'template-reader@example.test',role:'member'});await member.request.post(url+'/auth/join',{data:{name:'Template Reader',email:'template-reader@example.test',password:'template-password',token:invitation.token}});
  for(const type of ['issue','project','document']){
   const template=await create('templates',{name:type+' link template',type,title:'Template title',description:'<p>Template body.</p>',properties:{priority:0,labelIds:[]}}),link=url+'/settings/templates?template='+template.id;
   await page.goto(url+'/settings/templates');const row=page.locator('.feature-settings-row').filter({hasText:template.name});await row.getByRole('button',{name:'More actions',exact:true}).click();await page.locator('.feature-menu').getByRole('button',{name:'Copy link',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedLink)).toBe(link);
   await page.goto(link);let dialog=page.getByRole('dialog',{name:'Edit template',exact:true});await expect(dialog.getByLabel('Template name',{exact:true})).toHaveValue(template.name);await expect(dialog.getByLabel('Template type',{exact:true})).toHaveValue(type);await page.reload();await expect(dialog.getByLabel('Template name',{exact:true})).toHaveValue(template.name);expect((await(await page.request.get(url+'/api/v1/templates/'+template.id)).json()).version).toBe(template.version);
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(url+'/settings/templates');await page.goBack();await expect(dialog).toBeVisible();await page.goForward();await expect(dialog).toHaveCount(0);
   const renamed=template.name+' renamed';expect((await page.request.patch(url+'/api/v1/templates/'+template.id,{data:{name:renamed}})).ok()).toBeTruthy();await page.goto(link);await expect(dialog.getByLabel('Template name',{exact:true})).toHaveValue(renamed);await page.keyboard.press('Escape');
   await page.locator('.feature-settings-row').filter({hasText:renamed}).getByRole('button',{name:'Edit',exact:true}).click();await expect(page).toHaveURL(link);await expect(dialog.getByLabel('Template name',{exact:true})).toHaveValue(renamed);
   expect((await page.request.delete(url+'/api/v1/templates/'+template.id)).ok()).toBeTruthy();await page.reload();await expect(page.getByText('Template not found',{exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);
  }
  const team=await create('teams',{name:'Private template team',key:'PTT',private:true}),hidden=await create('templates',{name:'Private template content',type:'issue',teamId:team.id});const reader=await member.newPage();await reader.goto(url+'/settings/templates?template='+hidden.id);await expect(reader.getByText('Template not found',{exact:true})).toBeVisible();await expect(reader.getByRole('dialog',{name:'Edit template',exact:true})).toHaveCount(0);
 }finally{await member.close();await page.close();await app.close()}
});

test('label links open and save the selected label, integrate with history, and deny private or deleted labels',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),member=await browser.newContext();
 try{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedLink=text}}}));
  await page.request.post(url+'/auth/setup',{data:{name:'Label Owner',email:'label-links@example.test',password:'label-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};
  const invitation=await create('invitations',{email:'label-reader@example.test',role:'member'});await member.request.post(url+'/auth/join',{data:{name:'Label Reader',email:'label-reader@example.test',password:'label-password',token:invitation.token}});
  const label=await create('labels',{name:'Copied label',color:'#7775df',entityType:'issues'}),other=await create('labels',{name:'Other label',color:'#888888',entityType:'projects'}),link=url+'/settings/labels?label='+label.id;
  await page.goto(url+'/settings/labels');await page.locator('.feature-settings-row').filter({hasText:label.name}).getByRole('button',{name:'More actions',exact:true}).click();await page.locator('.feature-menu').getByRole('button',{name:'Copy link',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedLink)).toBe(link);
  await page.goto(link);const dialog=page.getByRole('dialog',{name:'Edit label',exact:true});await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue(label.name);await page.reload();await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue(label.name);expect((await(await page.request.get(url+'/api/v1/labels/'+label.id)).json()).version).toBe(label.version);
  await dialog.getByLabel('Name',{exact:true}).fill('Renamed copied label');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(url+'/settings/labels');await page.goBack();await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue('Renamed copied label');await page.goForward();await expect(dialog).toHaveCount(0);
  await page.locator('.feature-settings-row').filter({hasText:other.name}).getByRole('button',{name:'Edit',exact:true}).click();await expect(page).toHaveURL(url+'/settings/labels?label='+other.id);await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue(other.name);await page.goBack();await expect(dialog).toHaveCount(0);
  const team=await create('teams',{name:'Private label team',key:'PLT',private:true}),hidden=await create('labels',{name:'Private label',teamId:team.id});const reader=await member.newPage();await reader.goto(url+'/settings/labels?label='+hidden.id);await expect(reader.getByText('Label not found',{exact:true})).toBeVisible();await expect(reader.getByRole('dialog',{name:'Edit label',exact:true})).toHaveCount(0);
  expect((await page.request.delete(url+'/api/v1/labels/'+label.id)).ok()).toBeTruthy();await page.goto(link);await expect(page.getByText('Label not found',{exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);
 }finally{await member.close();await page.close();await app.close()}
});
