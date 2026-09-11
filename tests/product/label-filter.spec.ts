import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('same-name team labels match saved issue views and search while explicit team and raw API filters remain specific',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Label Filter',email:'label-filter@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
  const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};const a=state.teams[0],b=await create('teams',{name:'Other team',key:'OT'}),la=await create('labels',{name:'Shared label',teamId:a.id}),lb=await create('labels',{name:'Shared label',teamId:b.id});
  const status=(team:string)=>state.statuses.find((s:any)=>s.teamId===team&&s.type==='unstarted')?.id;
  const ia=await create('issues',{title:'Label Alpha',teamId:a.id,labelIds:[la.id],statusId:status(a.id)}),ib=await create('issues',{title:'Label Beta',teamId:b.id,labelIds:[lb.id]}),unlabeled=await create('issues',{title:'Label Empty',teamId:a.id,statusId:status(a.id)});
  const filter={match:'all',conditions:[{field:'labelIds',operator:'contains',value:la.id}]};const view=await create('views',{name:'Cross-team labels',entityType:'issues',filters:filter});await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(2);await expect(page.locator('.issue-row').filter({hasText:ib.title})).toBeVisible();
  const search=async(f:any)=>page.goto(url+'/search?q=Label&type=issues&filter='+encodeURIComponent(JSON.stringify(f)));await search(filter);await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toHaveCount(2);
  const narrowed={...filter,conditions:[...filter.conditions,{field:'teamId',operator:'eq',value:a.id}]};await search(narrowed);await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toHaveCount(1);await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toContainText(ia.title);
  await search({...filter,conditions:[{field:'labelIds',operator:'notContains',value:la.id}]});await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toHaveCount(1);await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toContainText(unlabeled.title);
  const api=await(await page.request.get(url+'/api/v1/search?q=Label&kinds=issues&filter='+encodeURIComponent(JSON.stringify(filter)))).json();expect(api.nodes.map((n:any)=>n.id)).toEqual([ia.id]);
  expect((await page.request.patch(url+'/api/v1/labels/'+lb.id,{data:{archivedAt:new Date().toISOString()}})).ok()).toBeTruthy();await search(filter);await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toHaveCount(2);
  await page.route('**/api/v1/search?**',route=>route.abort());await search(filter);await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option')).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('open and reloaded search filters follow merged labels through another merge and cached search',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Merge Reader',email:'merge-filter@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();const create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());const a=await create('labels',{name:'Old label'}),b=await create('labels',{name:'Kept label'}),c=await create('labels',{name:'Final label'}),issue=await create('issues',{title:'Durable filter work',teamId:state.teams[0].id,labelIds:[a.id]});
  const filter={match:'all',conditions:[{field:'labelIds',operator:'eq',value:a.id}]},link=url+'/search?q=Durable&type=issues&filter='+encodeURIComponent(JSON.stringify(filter)),results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await page.goto(link);await expect(results).toHaveCount(1);expect((await page.request.patch(url+'/api/v1/labels/'+a.id,{data:{mergeIntoId:b.id}})).ok()).toBeTruthy();await expect.poll(async()=>(await(await page.request.get(url+'/api/v1/issues/'+issue.id)).json()).labelIds).toEqual([b.id]);await expect(results).toHaveCount(1);await page.reload();await expect(results).toHaveCount(1);
  expect((await page.request.patch(url+'/api/v1/labels/'+b.id,{data:{mergeIntoId:c.id}})).ok()).toBeTruthy();await page.reload();await expect(results).toHaveCount(1);await expect(results).toContainText(issue.title);await expect(page.locator('.filter-condition select').nth(2)).toHaveValue(c.id);expect((await(await page.request.get(url+'/api/v1/search?q=Durable&kinds=issues&filter='+encodeURIComponent(JSON.stringify(filter)))).json()).nodes).toHaveLength(0);
  await page.route('**/api/v1/search?**',route=>route.abort());await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(1);
 }finally{await page.close();await app.close()}
});

test('saved group filters survive label conversion and search current children online and cached',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Group Reader',email:'group-filter@example.test',password:'label-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
  const label=await create('labels',{name:'Area'}),filter={match:'all',conditions:[{field:'labelIds',operator:'eq',value:label.id}]},view=await create('views',{name:'Area work',entityType:'issues',filters:filter});
  expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{convertTo:'labelGroups'}})).ok()).toBeTruthy();
  const child=await create('labels',{name:'Frontend',labelGroupId:label.id});
  const work=await create('issues',{title:'Group matching work',teamId:state.teams[0].id,labelIds:[child.id]});
  await create('issues',{title:'Group unrelated work',teamId:state.teams[0].id});
  const encoded=encodeURIComponent(JSON.stringify(filter));
  for(const endpoint of ['/api/v1/issues?filter='+encoded,'/api/v1/search?q=Group&kinds=issues&filter='+encoded]){const response=await page.request.get(url+endpoint);expect(response.ok()).toBeTruthy();expect((await response.json()).nodes.map((n:any)=>n.id)).toEqual([work.id]);}
  const insight=await page.request.get(url+'/api/v1/insights?kind=issues&filter='+encoded);expect(insight.ok()).toBeTruthy();expect((await insight.json()).totalCount).toBe(1);
  await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(work.title);
  const link=url+'/search?q=Group&type=issues&filter='+encodeURIComponent(JSON.stringify(filter));
  await page.goto(link);const results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(results).toHaveCount(1);await expect(results).toContainText(work.title);
  const chooser=page.locator('.filter-condition select').nth(2);await expect(chooser).toHaveValue(label.id);await expect(chooser.locator('option:checked')).toHaveText('Area (label group)');
  await chooser.selectOption(child.id);await expect(results).toHaveCount(1);await chooser.selectOption(label.id);await expect(chooser).toHaveValue(label.id);
  await page.route('**/api/v1/search?**',route=>route.abort());await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(1);await expect(results).toContainText(work.title);await expect(page.locator('.filter-condition select').nth(2)).toHaveValue(label.id);
 }finally{await page.close();await app.close()}
});

test('project group filters can be selected without exposing issue labels',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project Groups',email:'project-group-chooser@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};
 const group=await create('labelGroups',{name:'Phase',entityType:'projects'}),label=await create('labels',{name:'Pilot',entityType:'projects',labelGroupId:group.id}),issueLabel=await create('labels',{name:'Issue only'});
 const marker=await create('labels',{name:'Important',entityType:'projects'});await create('projects',{name:'Pilot project',teamIds:[state.teams[0].id],labelIds:[label.id,marker.id]});await create('projects',{name:'Another pilot',teamIds:[state.teams[0].id],labelIds:[label.id]});await create('projects',{name:'Unlabeled project',teamIds:[state.teams[0].id]});
 await page.goto(url+'/projects');await page.getByRole('button',{name:'Filter projects',exact:true}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.getByLabel('Project filter 1 property',{exact:true}).selectOption('labelIds');
 const chooser=page.getByLabel('Project filter 1 value',{exact:true});await expect(chooser.locator(`option[value="${issueLabel.id}"]`)).toHaveCount(0);await chooser.selectOption(group.id);await expect(chooser.locator('option:checked')).toHaveText('Phase (label group)');
 await page.getByLabel('Project filter 1 operator',{exact:true}).selectOption('in');await chooser.selectOption([group.id,marker.id]);await page.getByLabel('Project filter 1 operator',{exact:true}).selectOption('all');await expect.poll(()=>chooser.evaluate((el:HTMLSelectElement)=>Array.from(el.selectedOptions).map(o=>o.value).sort())).toEqual([group.id,marker.id].sort());
 await page.getByRole('button',{name:'Filter projects',exact:true}).click();await expect(page.locator('.feature-project-table tbody tr')).toHaveCount(1);await expect(page.locator('.feature-project-table tbody tr')).toContainText('Pilot project');
 await page.getByRole('button',{name:'Filter projects',exact:true}).click();await page.getByLabel('Project filter 1 operator',{exact:true}).selectOption('none');await page.getByRole('button',{name:'Filter projects',exact:true}).click();await expect(page.locator('.feature-project-table tbody tr')).toHaveCount(1);await expect(page.locator('.feature-project-table tbody tr')).toContainText('Unlabeled project');
 }finally{await page.close();await app.close()}
});

test('includes all requires a child from each selected group and survives search reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'All Groups',email:'all-groups@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const ga=await create('labelGroups',{name:'Area'}),gb=await create('labelGroups',{name:'Stage'}),la=await create('labels',{name:'Web',labelGroupId:ga.id}),lb=await create('labels',{name:'Ready',labelGroupId:gb.id});
 for(const [name,labelIds]of [['Both',[la.id,lb.id]],['Area',[la.id]],['Stage',[lb.id]],['Neither',[]]] as const)await create('issues',{title:'Multigroup '+name,teamId:state.teams[0].id,labelIds});
 const filter={match:'all',conditions:[{field:'labelIds',operator:'in',value:[ga.id,gb.id]}]};
 await page.goto(url+'/search?q=Multigroup&type=issues&filter='+encodeURIComponent(JSON.stringify(filter)));const results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(results).toHaveCount(3);
 const controls=page.locator('.filter-condition select');await controls.nth(1).selectOption('all');await expect(controls.nth(2)).toHaveValues([ga.id,gb.id]);await expect(results).toHaveCount(1);await expect(results).toContainText('Multigroup Both');
 await page.reload();await expect(controls.nth(1)).toHaveValue('all');await expect(controls.nth(2)).toHaveValues([ga.id,gb.id]);await expect(results).toHaveCount(1);
 await controls.nth(1).selectOption('none');await expect(controls.nth(2)).toHaveValues([ga.id,gb.id]);await expect(results).toHaveCount(1);await expect(results).toContainText('Multigroup Neither');
 const noneFilter={match:'all',conditions:[{field:'labelIds',operator:'none',value:[ga.id,gb.id]}]};const response=await page.request.get(url+'/api/v1/search?q=Multigroup&kinds=issues&filter='+encodeURIComponent(JSON.stringify(noneFilter)));expect(response.ok()).toBeTruthy();expect((await response.json()).nodes.map((n:any)=>n.title)).toEqual(['Multigroup Neither']);
 await page.route('**/api/v1/search?**',route=>route.abort());await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(1);await expect(results).toContainText('Multigroup Neither');await expect(controls.nth(1)).toHaveValue('none');
 await controls.nth(0).selectOption('statusId');await expect(controls.nth(1)).toHaveValue('eq');
 }finally{await page.close();await app.close()}
});
