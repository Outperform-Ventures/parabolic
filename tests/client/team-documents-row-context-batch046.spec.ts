import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('team document rows expose the retained searchable context actions and safe backed operations',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Document context owner',email:'document-context-batch046@example.test',password:'documents-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},otherTeam=app.repo.create(actor,'teams',{name:'Ops',key:'OPS'}),project=app.repo.create(actor,'projects',{name:'Launch project',teamIds:[team.id]}),cycle=app.repo.create(actor,'cycles',{teamId:team.id,name:'Retained cycle',startDate:new Date(Date.now()-86400000).toISOString(),endDate:new Date(Date.now()+86400000).toISOString()}),document=app.repo.create(actor,'documents',{teamId:team.id,cycleId:cycle.id,title:'Context handbook',content:'<p>Launch notes</p>',userId:state.user.id});
  const retainedSections=[{id:'runbooks',name:'Runbooks',resources:[{id:'existing-link',title:'Existing link',url:'https://example.com'}]}];app.repo.update(actor,'teams',team.id,{overviewSections:retainedSections});
  await page.goto(url+'/team/'+team.id+'/documents');
  const row=page.locator(`[data-document-id="${document.id}"]`),open=()=>row.click({button:'right'});
  await open();
  let search=page.getByRole('searchbox',{name:'Filter document actions',exact:true}),root=search.locator('..');
  await expect(search).toBeFocused();await expect(root.getByRole('status')).toHaveText('Showing all items');
  const direct=root.locator(':scope > [role="menuitem"]');
  await expect(direct).toHaveCount(11);
  await expect(direct).toContainText(['Move to','Pin to overview','Duplicate','Rename…','Favorite','Copy','Remind me','Show document history','Delete','Open in new window','Open in new tab']);
  await search.fill('copy');await expect(root.getByRole('status')).toHaveText('Showing 5 items');
  await expect(root.locator(':scope > [role="menuitem"]:visible')).toContainText(['Copy','Copy URL','Copy title','Copy title as link','Copy content as Markdown']);
  await search.fill('');await root.getByRole('menuitem',{name:/^Move to/}).click();
  const move=page.getByRole('menu',{name:'Move to',exact:true});await expect(move.getByRole('searchbox')).toBeFocused();await expect(move).toContainText('Teams');await expect(move).toContainText('Projects');await expect(move.getByRole('menuitem')).toContainText([team.name,otherTeam.name,project.name]);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');

  await open();await page.getByRole('menuitem',{name:'Pin to overview',exact:true}).click();
  await expect.poll(()=>app.repo.raw('teams',team.id)?.overviewResources?.some((resource:any)=>resource.documentId===document.id)).toBe(true);expect(app.repo.raw('teams',team.id)?.overviewSections).toEqual(retainedSections);
  const pinned=app.repo.raw('teams',team.id)!;app.repo.update(actor,'teams',team.id,{overviewResources:[],overviewSections:[...retainedSections,{id:'pinned',name:'Pinned',resources:[pinned.overviewResources[0]]}]});await page.reload();await open();await page.getByRole('menuitem',{name:'Pin to overview',exact:true}).click();await expect.poll(()=>app.repo.raw('teams',team.id)?.overviewResources).toEqual([]);
  await open();await page.getByRole('menuitem',{name:'Duplicate',exact:true}).click();
  await expect.poll(()=>app.repo.all('documents',state.workspaceId).find(item=>item.title==='Context handbook (copy)')?.cycleId).toBe(cycle.id);
  await open();await page.getByRole('menuitem',{name:/^Rename…/}).click();const rename=page.getByRole('dialog',{name:'Rename document',exact:true});await expect(rename.getByLabel('Command menu')).toHaveValue('Context handbook');await rename.getByLabel('Command menu').fill('Renamed handbook');await expect(rename.getByRole('option')).toHaveText('Rename document to “Renamed handbook”');await rename.getByRole('option').click();await expect.poll(()=>app.repo.raw('documents',document.id)?.title).toBe('Renamed handbook');
  await row.click({button:'right'});await page.getByRole('menuitem',{name:/^Remind me/}).click();const reminder=page.getByRole('menu',{name:'Remind me',exact:true});await expect(reminder.getByRole('searchbox')).toHaveAttribute('placeholder','Try: 4 pm, 2 days, in 5 weeks…');await expect(reminder.getByRole('menuitem')).toContainText(['An hour from now','Tomorrow','Next week','A month from now','Custom…']);await reminder.getByRole('menuitem',{name:/^Tomorrow/}).click();await expect.poll(()=>app.repo.all('notifications',state.workspaceId).some(item=>item.type==='reminder'&&item.entityId===document.id)).toBe(true);
 }finally{await page.close();await app.close()}
});

test('team document context opens history and uses distinct desktop tab and window APIs',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Document routes owner',email:'document-routes-batch046@example.test',password:'documents-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},document=app.repo.create(actor,'documents',{teamId:team.id,title:'Route handbook',content:'',userId:state.user.id});
  await page.goto(url+'/team/'+team.id+'/documents');await page.evaluate(()=>{(window as any).__documentOpenCalls=[];(window as any).desktop={newTab:async(route:string)=>(window as any).__documentOpenCalls.push(['tab',route]),newWindow:async(route:string)=>(window as any).__documentOpenCalls.push(['window',route])}});
  const row=page.locator(`[data-document-id="${document.id}"]`);
  await row.click({button:'right'});await page.getByRole('menuitem',{name:'Show document history',exact:true}).click();await expect(page.getByRole('dialog',{name:'Restore version for Route handbook',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close modal dialog',exact:true}).click();
  await row.click({button:'right'});await page.getByRole('menuitem',{name:/^Open in new window/}).click();await row.click({button:'right'});await page.getByRole('menuitem',{name:'Open in new tab',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__documentOpenCalls)).toEqual([['window',`/document/${document.id}`],['tab',`/document/${document.id}`]]);
 }finally{await page.close();await app.close()}
});
