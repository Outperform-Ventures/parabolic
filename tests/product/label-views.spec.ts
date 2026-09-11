import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('label views keep exact scope, follow group membership, and retain favorites and keyboard access',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Label Views',email:'labelviews@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const other=await create('teams',{name:'Other team',key:'OTH'});
 const label=await create('labels',{name:'Design',teamId:team.id,group:'Discipline'}),sibling=await create('labels',{name:'Research',teamId:team.id,group:'Discipline'}),same=await create('labels',{name:'Design',teamId:other.id});
 await create('issues',{title:'Scoped design',teamId:team.id,labelIds:[label.id]});
 await create('issues',{title:'Scoped research',teamId:team.id,labelIds:[sibling.id]});
 await create('issues',{title:'Other design',teamId:other.id,labelIds:[same.id]});
 await page.goto(url+'/label/'+label.id);
 await expect(page.locator('.page-header h1')).toHaveText('Design');
 await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Scoped design');
 await page.getByRole('switch',{name:'Add to favorites',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();return s.favorites.some((f:any)=>f.route==='/label/'+label.id&&f.label==='Design')}).toBeTruthy();
 await page.reload();await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.keyboard.press('o');await page.keyboard.press('l');await expect(page.getByRole('textbox',{name:'Open label',exact:true})).toBeVisible();await page.getByRole('button',{name:'Discipline',exact:true}).click();await expect(page.locator('.page-header h1')).toHaveText('Discipline');await expect(page.locator('.issue-row')).toHaveCount(2);
 expect((await page.request.patch(url+'/api/v1/labels/'+sibling.id,{data:{group:null,labelGroupId:null}})).ok()).toBeTruthy();
 await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.goto(url+'/label/missing-label');await expect(page.locator('.issue-row')).toHaveCount(0);await expect(page.locator('.page-header h1')).toHaveText('Label unavailable');
 }finally{await page.close();await app.close()}
});

test('detail labels open their view and creation inherits its label and team',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Label Flow',email:'labelflow@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const label=await create('labels',{name:'UX',teamId:team.id}),issue=await create('issues',{title:'Existing UX',teamId:team.id,labelIds:[label.id]});
 await page.goto(url+'/issues/'+issue.id);await page.locator('.detail-labels').getByRole('link',{name:'UX',exact:true}).click();
 await expect(page).toHaveURL(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.getByRole('switch',{name:'Add to favorites',exact:true}).click();await expect(page.getByRole('switch',{name:'Remove from favorites',exact:true})).toHaveAttribute('aria-checked','true');
 await page.getByRole('switch',{name:'Remove from favorites',exact:true}).click();await expect(page.getByRole('switch',{name:'Add to favorites',exact:true})).toHaveAttribute('aria-checked','false');
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();return s.favorites.filter((f:any)=>!f.deletedAt&&f.route==='/label/'+label.id).length}).toBe(0);
 await page.keyboard.press('c');await page.getByLabel('Issue title',{exact:true}).fill('Created in UX');await page.getByRole('button',{name:'Create issue',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();const i=s.issues.find((i:any)=>i.title==='Created in UX');return i?{teamId:i.teamId,labelIds:i.labelIds}:null}).toEqual({teamId:team.id,labelIds:[label.id]});
 await expect(page.locator('.issue-row')).toHaveCount(2);await page.reload();await expect(page.locator('.issue-row')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('workspace label views span teams while filters only narrow their membership',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Workspace Labels',email:'workspace-label@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const other=await create('teams',{name:'Other',key:'OTR'}),label=await create('labels',{name:'Workspace UX'});
 await create('issues',{title:'Urgent labeled',teamId:team.id,labelIds:[label.id],priority:1});
 await create('issues',{title:'Other team labeled',teamId:other.id,labelIds:[label.id],priority:2});
 await create('issues',{title:'Urgent outside scope',teamId:team.id,priority:1});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(2);
 await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill('Priority Urgent');await page.getByRole('menuitem',{name:'Priority Urgent',exact:true}).click();await page.keyboard.press('Escape');
 await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Urgent labeled');
 await page.getByRole('button',{name:'Remove Priority filter',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('keyboard creation uses label scope and archived label views retain history without reapplying retired labels',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Archived View',email:'archive-view@example.test',password:'label-password'}});
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const team=await create('teams',{name:'Label team',key:'LBL'}),label=await create('labels',{name:'Retired UX',teamId:team.id});
 await create('issues',{title:'Historical labeled issue',teamId:team.id,labelIds:[label.id]});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.keyboard.press('c');await page.getByLabel('Issue title',{exact:true}).fill('Keyboard scoped issue');await page.getByRole('button',{name:'Create issue',exact:true}).click();
 const saved=async(title:string)=>{const s=await(await page.request.get(url+'/api/v1/state')).json();const i=s.issues.find((i:any)=>i.title===title);return i?{teamId:i.teamId,labelIds:i.labelIds}:null};
 await expect.poll(()=>saved('Keyboard scoped issue')).toEqual({teamId:team.id,labelIds:[label.id]});await expect(page.locator('.issue-row')).toHaveCount(2);
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{archivedAt:new Date().toISOString()}})).ok()).toBeTruthy();
 await page.reload();await expect(page.locator('.issue-row')).toHaveCount(2);
 for(const [method,title] of [['button','New after archive'],['keyboard','Keyboard after archive']]){
 if(method==='button')await page.getByRole('button',{name:'Create new issue',exact:true}).click();else await page.keyboard.press('c');
 await page.getByLabel('Issue title',{exact:true}).fill(title);await page.getByRole('button',{name:'Create issue',exact:true}).click();
 await expect.poll(()=>saved(title)).toEqual({teamId:team.id,labelIds:[]});await expect(page.getByLabel('Issue title',{exact:true})).toHaveCount(0);
 }
 await expect(page.locator('.issue-row')).toHaveCount(2);await page.reload();await expect(page.locator('.issue-row')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('label names stay current in tabs, favorites and an open command picker',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Label Navigation',email:'label-navigation@example.test',password:'label-password'}});
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const label=await create('labels',{name:'Original label'});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.app-tab.active')).toContainText('Original label');
 await page.getByRole('switch',{name:'Add to favorites',exact:true}).click();await expect(page.locator('.favorites-section a')).toContainText('Original label');
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{name:'Renamed label'}})).ok()).toBeTruthy();
 await expect(page.locator('.app-tab.active')).toContainText('Renamed label');await expect(page.locator('.favorites-section a')).toContainText('Renamed label');
 const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');await page.keyboard.press(mod+'+k');const input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill('l Renamed');await expect(page.getByRole('option')).toHaveCount(1);
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{name:'Final label'}})).ok()).toBeTruthy();await expect(page.getByRole('option')).toHaveCount(0);await input.fill('f Final label');await expect(page.getByRole('option')).toHaveCount(1);await expect(page.getByRole('option')).toContainText('Final label');await input.press('Enter');
 await expect(page.locator('.page-header h1')).toHaveText('Final label');await page.reload();await expect(page.locator('.app-tab.active')).toContainText('Final label');
 expect((await page.request.delete(url+'/api/v1/labels/'+label.id)).ok()).toBeTruthy();await expect(page.locator('.app-tab.active')).toContainText('Label unavailable');await expect(page.locator('.favorites-section a')).toContainText('Label unavailable');await expect(page.locator('.issue-row')).toHaveCount(0);
 const group=await create('labelGroups',{name:'Original group'});await page.goto(url+'/label-group/'+group.id);await expect(page.locator('.app-tab.active')).toContainText('Original group');
 expect((await page.request.patch(url+'/api/v1/labelGroups/'+group.id,{data:{name:'Renamed group'}})).ok()).toBeTruthy();await expect(page.locator('.app-tab.active')).toContainText('Renamed group');
 }finally{await page.close();await app.close()}
});

test('label group headings navigate while collapse and board drag keep their own behavior',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Board labels',email:'board-labels@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const a=await create('labels',{name:'Design',group:'Discipline'}),b=await create('labels',{name:'Research',group:'Discipline'});
 const issue=await create('issues',{title:'Grouped work',teamId:team.id,labelIds:[a.id]});await create('issues',{title:'Research work',teamId:team.id,labelIds:[b.id]});
 const route=url+'/team/'+team.id+'/all';await page.goto(route);await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('labelIds');await page.keyboard.press('Escape');
 const header=()=>page.locator('.group-header[data-group-id="'+a.id+'"]');
 await header().getByRole('button',{name:'Toggle Design',exact:true}).click();await expect(page.locator('.issue-row[data-issue-id="'+issue.id+'"]')).toHaveCount(0);await expect(page).toHaveURL(route);
 await header().getByRole('button',{name:'Toggle Design',exact:true}).click();await expect(page.locator('.issue-row[data-issue-id="'+issue.id+'"]')).toBeVisible();
 await header().getByRole('link',{name:'Design',exact:true}).click();await expect(page).toHaveURL(url+'/label/'+a.id);await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.goto(route);await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');
 await page.locator('.board-card[data-issue-id="'+issue.id+'"]').dragTo(page.locator('.group-header[data-group-id="'+b.id+'"]'));
 await expect.poll(async()=>(await(await page.request.get(url+'/api/v1/issues/'+issue.id)).json()).labelIds).toEqual([b.id]);
 await page.locator('.group-header[data-group-id="'+b.id+'"]').getByRole('link',{name:'Research',exact:true}).click();await expect(page).toHaveURL(url+'/label/'+b.id);await expect(page.locator('.issue-row')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('creation from an archived label bucket preserves priority without assigning the retired label',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Historical buckets',email:'historical-buckets@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const label=await create('labels',{name:'Historical'});await create('issues',{title:'Retained work',teamId:team.id,labelIds:[label.id],priority:1});
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{archivedAt:new Date().toISOString()}})).ok()).toBeTruthy();
 await page.goto(url+'/team/'+team.id+'/all');await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('labelIds');await page.getByLabel('Sub-grouping',{exact:true}).selectOption('priority');await page.keyboard.press('Escape');
 await expect(page.locator('.group-header[data-group-id="'+label.id+'"]')).toContainText('Historical');
 await page.locator('.issue-subgroup-header[data-group-id="1"]').getByRole('button',{name:'Add issue to Urgent',exact:true}).click();
 await page.getByLabel('Issue title',{exact:true}).fill('New from historical bucket');await page.getByRole('button',{name:'Create issue',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();const i=s.issues.find((i:any)=>i.title==='New from historical bucket');return i?{priority:i.priority,labelIds:i.labelIds}:null}).toEqual({priority:1,labelIds:[]});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Retained work');
 }finally{await page.close();await app.close()}
});

test('retired label drop targets reject new assignments and permit historical subgroup edits',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Retired drop',email:'retired-drop@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
 const label=await create('labels',{name:'Historical drag'}),historical=await create('issues',{title:'Already labeled',teamId:team.id,labelIds:[label.id],priority:2}),fresh=await create('issues',{title:'Not labeled',teamId:team.id,priority:1});
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{archivedAt:new Date().toISOString()}})).ok()).toBeTruthy();
 await page.goto(url+'/team/'+team.id+'/all');await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('labelIds');await page.getByLabel('Sub-grouping',{exact:true}).selectOption('priority');await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');
 const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/batch'))writes.push(request.postData()||'')});
 const target=page.locator('.swimlane-cell[data-column-id="'+label.id+'"][data-row-id="1"]');
 await page.locator('.board-card[data-issue-id="'+fresh.id+'"]').dragTo(target);
 await expect(page.getByText('Archived labels cannot be assigned to new issues. Unarchive the label first.',{exact:true})).toBeVisible();expect(writes).toHaveLength(0);
 expect((await(await page.request.get(url+'/api/v1/issues/'+fresh.id)).json()).labelIds).toEqual([]);
 await page.locator('.board-card[data-issue-id="'+historical.id+'"]').dragTo(target);
 await expect.poll(async()=>{const i=await(await page.request.get(url+'/api/v1/issues/'+historical.id)).json();return {priority:i.priority,labelIds:i.labelIds}}).toEqual({priority:1,labelIds:[label.id]});
 }finally{await page.close();await app.close()}
});

test('label views retain the complete label scope without team status-tab chrome',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Scoped tabs',email:'scoped-tabs@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],started=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='started'),backlog=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='backlog');
 const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());const label=await create('labels',{name:'Scoped navigation'});
 await create('issues',{title:'Active inside',teamId:team.id,statusId:started.id,labelIds:[label.id]});await create('issues',{title:'Backlog inside',teamId:team.id,statusId:backlog.id,labelIds:[label.id]});await create('issues',{title:'Active outside',teamId:team.id,statusId:started.id});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(2);await expect(page.locator('.page-tabs')).toHaveCount(0);await expect(page.locator('.issue-row').filter({hasText:'Active inside'})).toHaveCount(1);await expect(page.locator('.issue-row').filter({hasText:'Backlog inside'})).toHaveCount(1);
 await page.reload();await expect(page.locator('.issue-row')).toHaveCount(2);await expect(page.locator('.page-tabs')).toHaveCount(0);
 }finally{await page.close();await app.close()}
});
