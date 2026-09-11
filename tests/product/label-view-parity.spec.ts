import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('label and label-group issue context and saved views preserve their source scope',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Label parity',email:'label-parity@example.test',password:'label-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
  const label=await create('labels',{name:'Scoped label',teamId:team.id}),group=await create('labelGroups',{name:'Scoped group',teamId:team.id}),child=await create('labels',{name:'Group child',teamId:team.id,labelGroupId:group.id});
  const direct=await create('issues',{title:'Direct label issue',teamId:team.id,labelIds:[label.id],priority:1}),grouped=await create('issues',{title:'Group child issue',teamId:team.id,labelIds:[child.id],priority:1});
  await create('issues',{title:'Outside both scopes',teamId:team.id});

  for(const source of [
   {route:'/label/'+label.id,name:label.name,issue:direct,viewName:'Saved label scope',filterId:label.id},
   {route:'/label-group/'+group.id,name:group.name,issue:grouped,viewName:'Saved group scope',filterId:group.id},
  ]){
   await page.goto(url+source.route);await expect(page.locator('.issue-row')).toHaveCount(1);
   await page.locator('.issue-row[data-issue-id="'+source.issue.id+'"]').click();
   await expect(page.locator('.issue-context-link')).toHaveAttribute('href',source.route);
   await expect(page.locator('.issue-context-link')).toHaveText(source.name);
   await page.locator('.issue-context-link').click();
   await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill('Priority Urgent');await page.getByRole('menuitem',{name:'Priority Urgent',exact:true}).click();await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Save filtered view',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'New view',exact:true});await dialog.getByLabel('Name',{exact:true}).fill(source.viewName);await dialog.getByRole('button',{name:'Create view',exact:true}).click();
   await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(source.issue.title);
   await expect.poll(async()=>{const saved=(await(await page.request.get(url+'/api/v1/state')).json()).views.find((view:any)=>view.name===source.viewName);return saved?.filters?.conditions}).toContainEqual({field:'labelIds',operator:'contains',value:source.filterId});
  }
 }finally{await page.close();await app.close()}
});

test('label collection chrome follows the native label hierarchy and empty defaults',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Label shell',email:'label-shell@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const label=await(await page.request.post(url+'/api/v1/labels',{data:{name:'Native shell',teamId:team.id,color:'#5e6ad2'}})).json();await page.goto(url+'/label/'+label.id);
  const header=page.locator('.label-view-header');await expect(header.getByRole('button',{name:'Open issue label',exact:true})).toContainText('Native shell');const favorite=header.getByRole('switch',{name:'Add to favorites',exact:true});await expect(favorite).toBeVisible();await expect(favorite).toHaveAttribute('aria-checked','false');await expect(header.getByRole('button',{name:'Label options',exact:true})).toBeVisible();
  await expect(header.getByRole('link',{name:team.name,exact:true})).toHaveCount(0);await expect(header.getByRole('button',{name:'New issue',exact:true})).toHaveCount(0);await expect(page.locator('.page-tabs')).toHaveCount(0);await expect(page.getByRole('button',{name:'Add view',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Toggle insights',exact:true})).toHaveCount(0);
  await expect(header.getByRole('button',{name:'Open notifications',exact:true})).toHaveCount(0);await expect(page.getByRole('status')).toHaveText('No matching issues');await expect(page.locator('.group-header')).toHaveCount(0);const details=page.getByRole('complementary',{name:'Label details'});await expect(details).toContainText('Visibility'+team.name);await expect(details.getByRole('button',{name:'Add to favorites',exact:true})).toBeVisible();await expect(details.getByRole('button',{name:'Actions',exact:true})).toBeVisible();
  await expect(page.locator('.label-view-empty')).toHaveCSS('gap','24px');await expect(page.locator('.label-view-empty')).toHaveCSS('padding-bottom','20px');await expect(page.locator('.label-view-empty svg')).toHaveAttribute('width','140');await expect(page.locator('.label-view-empty svg')).toHaveAttribute('height','82');
  await page.getByRole('button',{name:'Display options',exact:true}).click();await expect(page.getByLabel('Grouping',{exact:true})).toHaveValue('statusId');await expect(page.getByLabel('Ordering',{exact:true})).toHaveValue('priority');await expect(page.getByRole('checkbox',{name:'Show empty groups',exact:true})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Nested sub-issues',exact:true})).toBeChecked();
  await page.keyboard.press('Escape');await header.getByRole('button',{name:'Open issue label',exact:true}).click();await expect(page.getByLabel('Open issue label…',{exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});

test('converted label aliases apply creation defaults from the resolved destination kind',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Label alias',email:'label-alias@example.test',password:'label-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const group=await(await page.request.post(url+'/api/v1/labelGroups',{data:{name:'Soon a label',teamId:team.id}})).json();
  expect((await page.request.patch(url+'/api/v1/labelGroups/'+group.id,{data:{convertTo:'labels'}})).ok()).toBeTruthy();
  await page.goto(url+'/label-group/'+group.id);await expect(page.locator('.page-header h1')).toHaveText('Soon a label');
  await page.keyboard.press('c');await page.getByLabel('Issue title',{exact:true}).fill('Created from converted alias');await page.getByRole('button',{name:'Create issue',exact:true}).click();
  await expect.poll(async()=>{const fresh=await(await page.request.get(url+'/api/v1/state')).json(),issue=fresh.issues.find((row:any)=>row.title==='Created from converted alias');return issue&&{teamId:issue.teamId,labelIds:issue.labelIds}}).toEqual({teamId:team.id,labelIds:[group.id]});
  await expect(page.locator('.issue-row')).toHaveCount(1);
 }finally{await page.close();await app.close()}
});
