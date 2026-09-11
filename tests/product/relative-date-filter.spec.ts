import{test,expect}from'@playwright/test';import{createApp}from'../../src/server/app';import{resolve}from'node:path';import{resolveRelativeDate}from'../../src/shared/relative-date-filter';
test.use({timezoneId:'America/Los_Angeles'});
test('relative saved-view and search filters agree with the browser timezone online and cached',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let searchUnavailable=false,blockedSearches=0;const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(searchUnavailable&&request.url?.startsWith('/api/v1/search?')){blockedSearches++;request.socket.destroy()}else for(const listener of listeners)listener.call(app.server,request,response)});try{
 await page.request.post(url+'/auth/setup',{data:{name:'Relative Reader',email:'relative-browser@example.test',password:'date-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),clock={now:new Date(),timeZone:'America/Los_Angeles'};
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const included=await create('issues',{title:'Relative boundary',teamId:state.teams[0].id,dueDate:resolveRelativeDate('P1D',clock)});await create('issues',{title:'Relative later',teamId:state.teams[0].id,dueDate:resolveRelativeDate('P2D',clock)});await create('issues',{title:'Relative undated',teamId:state.teams[0].id});
 const filter={match:'all',conditions:[{field:'dueDate',operator:'lte',value:'P1D'}]},view=await create('views',{name:'Relative view',entityType:'issues',filters:filter}),encoded=encodeURIComponent(JSON.stringify(filter)),headers={'X-Parabolic-Time-Zone':clock.timeZone};
 for(const endpoint of ['/api/v1/issues?filter=','/api/v1/search?q=Relative&kinds=issues&filter=']){const response=await page.request.get(url+endpoint+encoded,{headers});expect(response.ok()).toBeTruthy();expect((await response.json()).nodes.map((n:any)=>n.id)).toEqual([included.id]);}
 const insight=await page.request.get(url+'/api/v1/insights?filter='+encoded,{headers});expect((await insight.json()).totalCount).toBe(1);
 expect((await page.request.get(url+'/api/v1/issues?filter='+encoded,{headers:{'X-Parabolic-Time-Zone':'Invalid/Zone'}})).status()).toBe(400);
 await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(included.title);
 let sentZone='';await page.route('**/api/v1/search?**',async route=>{sentZone=route.request().headers()['x-parabolic-time-zone'];await route.continue()});await page.goto(url+'/search?q=Relative&type=Issues&filter='+encoded);const results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(results).toHaveCount(1);expect(sentZone).toBe(clock.timeZone);await expect(results).toContainText(included.title);
 const datePicker=page.getByLabel('Due date filter value',{exact:true});await expect(datePicker).toHaveValue('day');await page.locator('.filter-condition select').nth(1).selectOption('after');await expect(datePicker).toHaveValue('day');await expect(results).toHaveCount(1);await expect(results).toContainText('Relative later');await page.locator('.filter-condition select').nth(1).selectOption('lte');await datePicker.selectOption('week');await expect(results).toHaveCount(2);await datePicker.selectOption('none');await expect(results).toHaveCount(1);await expect(results).toContainText('Relative undated');await datePicker.selectOption('custom');await page.getByLabel('Due date filter value custom date',{exact:true}).fill(resolveRelativeDate('P1D',clock)!);await expect(results).toHaveCount(1);await expect(results).toContainText(included.title);await datePicker.selectOption('range');const start=resolveRelativeDate('P1D',clock)!,end=resolveRelativeDate('P2D',clock)!;await page.getByLabel('Due date filter value start',{exact:true}).fill(start);await page.getByLabel('Due date filter value end',{exact:true}).fill(start);await expect(results).toHaveCount(1);await expect(results).toContainText(included.title);
 const rangeFilter={match:'all',conditions:[{field:'dueDate',operator:'within',value:[start,end]}]};const ranged=await page.request.get(url+'/api/v1/search?q=Relative&kinds=issues&filter='+encodeURIComponent(JSON.stringify(rangeFilter)),{headers});expect((await ranged.json()).nodes.map((n:any)=>n.id)).toEqual([included.id]);
 const searchLink=page.url();await page.goto(url+'/team/'+state.teams[0].id+'/all?insightContext='+encodeURIComponent(JSON.stringify({filter:rangeFilter})));await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(included.title);await page.goto(searchLink);await expect(results).toHaveCount(1);
 await page.locator('.filter-condition select').nth(1).selectOption('after');await expect(results).toHaveCount(1);await expect(results).toContainText('Relative later');await page.locator('.filter-condition select').nth(1).selectOption('within');
 await page.unroute('**/api/v1/search?**');searchUnavailable=true;await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(1);await expect(results).toContainText(included.title);
 await expect(page.getByLabel('Due date filter value',{exact:true})).toHaveValue('range');await expect(page.getByLabel('Due date filter value end',{exact:true})).toHaveValue(start);expect((await(await page.request.get(url+'/api/v1/views/'+view.id)).json()).filters.conditions[0].value).toBe('P1D');
 }finally{await page.close();await app.close()}
});

for(const surface of ['view','cached search'])test(`relative overdue ${surface} refreshes across local midnight`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let searchUnavailable=false,blockedSearches=0;const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(searchUnavailable&&request.url?.startsWith('/api/v1/search?')){blockedSearches++;request.socket.destroy()}else for(const listener of listeners)listener.call(app.server,request,response)});try{
 await page.request.post(url+'/auth/setup',{data:{name:'Midnight Reader',email:'midnight@example.test',password:'date-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Midnight work',teamId:state.teams[0].id,dueDate:'2026-09-06'}})).json();
 const filter={match:'all',conditions:[{field:'dueDate',operator:'lt',value:'P0D'}]},view=await(await page.request.post(url+'/api/v1/views',{data:{name:'Overdue',entityType:'issues',filters:filter}})).json();
 await page.clock.install({time:new Date('2026-09-07T06:59:00Z')});
 if(surface==='cached search')searchUnavailable=true;
 await page.goto(surface==='view'?url+'/view/'+view.id:url+'/search?q=Midnight&type=Issues&filter='+encodeURIComponent(JSON.stringify(filter)));
 const rows=surface==='view'?page.locator('.issue-row'):page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');
 if(surface==='cached search'){await expect(page.locator('.search-result-count')).toContainText('Cached');expect(blockedSearches).toBeGreaterThan(0)}else await expect(page.locator('.workspace-shell')).toBeVisible();
 await expect(rows).toHaveCount(0);await page.clock.fastForward(61000);await expect(rows).toHaveCount(1);await expect(rows).toContainText(issue.title);
 expect((await(await page.request.get(url+'/api/v1/views/'+view.id)).json()).filters.conditions[0].value).toBe('P0D');
 }finally{await page.close();await app.close()}
});

test('project date ranges select inclusive dates and preserve both bounds when changing comparison',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project Dates',email:'project-dates@example.test',password:'date-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 for(const [name,targetDate]of [['Range project','2026-09-06'],['Later project','2026-09-07']]){const response=await page.request.post(url+'/api/v1/projects',{data:{name,targetDate,teamIds:[state.teams[0].id]}});expect(response.ok()).toBeTruthy()}
 await page.goto(url+'/projects');await page.getByRole('button',{name:'Filter projects',exact:true}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.getByLabel('Project filter 1 property',{exact:true}).selectOption('targetDate');await page.getByLabel('Project filter 1 date value',{exact:true}).selectOption('range');await page.getByLabel('Project filter 1 date value start',{exact:true}).fill('2026-09-06');await page.getByLabel('Project filter 1 date value end',{exact:true}).fill('2026-09-06');
 const rows=page.locator('.feature-project-table tbody tr');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Range project');await page.getByLabel('Project filter 1 operator',{exact:true}).selectOption('after');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Later project');await expect(page.getByLabel('Project filter 1 date value end',{exact:true})).toHaveValue('2026-09-06');
 await page.getByLabel('Project filter 1 property',{exact:true}).selectOption('createdAt');await page.getByLabel('Project filter 1 date value',{exact:true}).selectOption('day');await expect(rows).toHaveCount(2);await page.getByLabel('Project filter 1 operator',{exact:true}).selectOption('before');await expect(rows).toHaveCount(0);await page.getByLabel('Project filter 1 property',{exact:true}).selectOption('updatedAt');await page.getByLabel('Project filter 1 date value',{exact:true}).selectOption('day');await expect(rows).toHaveCount(2);
 }finally{await page.close();await app.close()}
});

test('relative range dates stay readable without freezing bounds and external changes clear invalid drafts',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Relative Range',email:'relative-range@example.test',password:'date-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),clock={now:new Date(),timeZone:'America/Los_Angeles'},today=resolveRelativeDate('P0D',clock)!,last=resolveRelativeDate('P6D',clock)!;
 await page.request.post(url+'/api/v1/issues',{data:{title:'Relative range work',teamId:state.teams[0].id,dueDate:today}});
 const filter={match:'all',conditions:[{field:'dueDate',operator:'within',value:['P0D','P1W']}]};await page.goto(url+'/search?q=Relative&type=Issues&filter='+encodeURIComponent(JSON.stringify(filter)));
 const start=page.getByLabel('Due date filter value start',{exact:true}),end=page.getByLabel('Due date filter value end',{exact:true}),operator=page.locator('.filter-condition select').nth(1),results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');
 await expect(start).toHaveValue(today);await expect(end).toHaveValue(last);await expect(results).toHaveCount(1);await page.reload();await expect(start).toHaveValue(today);expect(JSON.parse(new URL(page.url()).searchParams.get('filter')!).conditions[0].value).toEqual(['P0D','P1W']);
 await start.fill('2099-01-01');await expect(page.getByRole('alert')).toContainText('End date must be');await expect(results).toHaveCount(1);await operator.selectOption('before');await expect(start).toHaveValue(today);await expect(end).toHaveValue(last);await expect(page.getByRole('alert')).toHaveCount(0);await expect(results).toHaveCount(0);
 await operator.selectOption('within');await expect(results).toHaveCount(1);await end.fill(today);await expect(results).toHaveCount(1);expect(JSON.parse(new URL(page.url()).searchParams.get('filter')!).conditions[0].value).toEqual([today,resolveRelativeDate('P1D',clock)]);
 }finally{await page.close();await app.close()}
});

test('relative timestamp saved views and cached search use the same duration semantics',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let unavailable=false;const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(unavailable&&request.url?.startsWith('/api/v1/search?'))request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)});
 try{
 const setup=await(await page.request.post(url+'/auth/setup',{data:{name:'Timestamp Browser',email:'timestamp-browser@example.test',password:'timestamp-password'}})).json();
 const actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']} as const;
 const state=await(await page.request.get(url+'/api/v1/state')).json();
 const create=async(title:string)=>{const r=await page.request.post(url+'/api/v1/issues',{data:{title,teamId:state.teams[0].id}});expect(r.ok()).toBeTruthy();return r.json()};
 const recent=await create('Timestamp recent'),old=await create('Timestamp old');
 app.repo.update({...actor,scopes:['admin'],now:new Date(Date.now()-48*3600000)},'issues',old.id,{description:'Older edit'});
 const filter={match:'all',conditions:[{field:'updatedAt',operator:'gte',value:'-PT1H'}]};
 const viewResponse=await page.request.post(url+'/api/v1/views',{data:{name:'Recent edits',entityType:'issues',filters:filter}});expect(viewResponse.ok()).toBeTruthy();const view=await viewResponse.json();
 await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(recent.title);
 await page.goto(url+'/search?q=Timestamp&type=Issues&filter='+encodeURIComponent(JSON.stringify(filter)));const rows=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(rows).toHaveCount(1);await expect(rows).toContainText(recent.title);
 const picker=page.getByLabel('Updated date filter value',{exact:true});await expect(picker).toHaveValue('relative');await expect(picker.locator('option:checked')).toHaveText('1 hour ago');
 await picker.selectOption('three-days');await expect(rows).toHaveCount(2);expect(JSON.parse(new URL(page.url()).searchParams.get('filter')!).conditions[0].value).toBe('-P3D');
 await picker.selectOption('day');await expect(rows).toHaveCount(1);await page.locator('.filter-condition select').nth(1).selectOption('before');await expect(rows).toHaveCount(1);await expect(rows).toContainText(old.title);
 await picker.selectOption('custom');await page.getByLabel('Updated date filter value custom date',{exact:true}).fill(resolveRelativeDate('P0D',{timeZone:'America/Los_Angeles'})!);await expect(rows).toHaveCount(1);await expect(rows).toContainText(recent.title);
 await picker.selectOption('range');const today=resolveRelativeDate('P0D',{timeZone:'America/Los_Angeles'})!;await page.getByLabel('Updated date filter value start',{exact:true}).fill(today);await page.getByLabel('Updated date filter value end',{exact:true}).fill(today);await expect(rows).toHaveCount(1);await expect(rows).toContainText(recent.title);
 unavailable=true;await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(rows).toHaveCount(1);await expect(rows).toContainText(recent.title);await expect(page.getByLabel('Updated date filter value end',{exact:true})).toHaveValue(today);
 expect((await(await page.request.get(url+'/api/v1/views/'+view.id)).json()).filters.conditions[0].value).toBe('-PT1H');
 }finally{await page.close();await app.close()}
});

for(const surface of ['view','search','cached search','projects','insights','hidden view','slow search'])test(`moving timestamp ${surface} removes aged results while idle`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let current=new Date('2026-09-06T12:00:00Z');
 const resolveFilter=app.repo.resolveFilter.bind(app.repo);app.repo.resolveFilter=(actor,filter)=>resolveFilter({...actor,now:current},filter);
 let releaseSearch!:()=>void,searchRequests=0;const searchGate=new Promise<void>(resolve=>{releaseSearch=resolve});
 const listeners=app.server.listeners('request');if(surface==='cached search'||surface==='slow search'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(request.url?.startsWith('/api/v1/search?')){searchRequests++;if(surface==='cached search')request.socket.destroy();else void searchGate.then(()=>{for(const listener of listeners)listener.call(app.server,request,response)})}else for(const listener of listeners)listener.call(app.server,request,response)})}
 try{
 const setup=await(await page.request.post(url+'/auth/setup',{data:{name:'Moving Reader',email:'moving@example.test',password:'moving-password'}})).json();const state=await(await page.request.get(url+'/api/v1/state')).json();
 const actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date(+current-1000)};
 app.repo.create(actor,'issues',{title:'Moving timestamp work',teamId:state.teams[0].id});app.repo.create(actor,'projects',{name:'Moving timestamp project',teamIds:[state.teams[0].id]});
 const filter={match:'all',conditions:[{field:'createdAt',operator:'gte',value:'-PT1M'}]};const saved=app.repo.create(actor,'views',{name:'Moving timestamps',entityType:surface==='projects'?'projects':'issues',filters:filter});
 await page.clock.install({time:current});
 const route=surface==='insights'?'/insights?config='+encodeURIComponent(JSON.stringify({filters:filter,measure:'Issue count',chartType:'Metric'})):surface.includes('search')?'/search?type=Issues&q=Moving&filter='+encodeURIComponent(JSON.stringify(filter)):'/view/'+saved.id;
 await page.goto(url+route);
 const rows=surface==='projects'?page.locator('.feature-project-table tbody tr'):surface.includes('search')?page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option'):page.locator('.issue-row');
 const metric=page.locator('.feature-metric').filter({has:page.getByText('Matching issues',{exact:true})}).locator('strong');
 if(surface==='cached search')await expect(page.locator('.search-result-count')).toContainText('Cached');
 if(surface==='slow search'){await expect.poll(()=>searchRequests).toBe(1);await page.clock.fastForward(3100);await page.clock.runFor(200);expect(searchRequests).toBe(1);releaseSearch()}
 if(surface==='insights')await expect(metric).toHaveText('1');else await expect(rows).toHaveCount(1);
 if(surface==='hidden view')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
 current=new Date(+current+61000);await page.clock.fastForward(61000);await page.clock.runFor(200);
 if(surface==='hidden view'){await expect(rows).toHaveCount(1);await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'))})}
 if(surface==='insights')await expect(metric).toHaveText('0');else await expect(rows).toHaveCount(0);
 expect(app.repo.get(actor,'views',saved.id).filters.conditions[0].value).toBe('-PT1M');
 }finally{await page.close();await app.close()}
});

test('search applies a midnight boundary that passes while the previous response is pending',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let current=new Date('2026-09-07T06:59:00Z'),release:()=>void=()=>{},held=false;
 const originalResolve=app.repo.resolveFilter.bind(app.repo);app.repo.resolveFilter=(actor,filter)=>originalResolve({...actor,now:current},filter);
 const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(!held&&request.url?.startsWith('/api/v1/search?')){const end=response.end;response.end=function(...args:any[]){held=true;release=()=>{end.apply(response,args as any)};return response} as typeof response.end}for(const listener of listeners)listener.call(app.server,request,response)});
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Pending Midnight',email:'pending-midnight@example.test',password:'midnight-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();await page.request.post(url+'/api/v1/issues',{data:{title:'Pending midnight issue',teamId:state.teams[0].id,dueDate:'2026-09-06'}});
 await page.clock.install({time:current});const filter={match:'all',conditions:[{field:'dueDate',operator:'lt',value:'P0D'}]};await page.goto(url+'/search?type=Issues&q=Pending&filter='+encodeURIComponent(JSON.stringify(filter)));await expect.poll(()=>held).toBeTruthy();
 current=new Date(+current+61000);await page.clock.fastForward(61000);release();
 const rows=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Pending midnight issue');
 }finally{release();await page.close();await app.close()}
});

for(const surface of ['search','projects'])test(`on-date ${surface} matches the complete local day and survives reload`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let unavailable=false;const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(unavailable&&request.url?.startsWith('/api/v1/search?'))request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)});
 try{
 const setup=await(await page.request.post(url+'/auth/setup',{data:{name:'On Browser',email:'on-browser@example.test',password:'on-browser-password'}})).json(),state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};
 for(const [index,at]of ['2026-11-01T06:59:59Z','2026-11-01T07:00:00Z','2026-11-01T09:30:00Z','2026-11-02T07:59:59Z','2026-11-02T08:00:00Z'].entries())app.repo.create({...actor,now:new Date(at)},surface==='search'?'issues':'projects',surface==='search'?{title:'On browser '+index,teamId:state.teams[0].id}:{name:'On browser '+index,teamIds:[state.teams[0].id]});
 const filter={match:'all',conditions:[{field:'createdAt',operator:'gte',value:'2026-11-01'}]};
 if(surface==='search')await page.goto(url+'/search?type=Issues&q=On%20browser&filter='+encodeURIComponent(JSON.stringify(filter)));
 else{await page.goto(url+'/projects');await page.getByRole('button',{name:'Filter projects',exact:true}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.getByLabel('Project filter 1 property',{exact:true}).selectOption('createdAt');await page.getByLabel('Project filter 1 date value',{exact:true}).selectOption('custom');await page.getByLabel('Project filter 1 date value custom date',{exact:true}).fill('2026-11-01')}
 const rows=surface==='search'?page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option'):page.locator('.feature-project-table tbody tr');await expect(rows).toHaveCount(4);
 const operator=surface==='search'?page.locator('.filter-condition select').nth(1):page.getByLabel('Project filter 1 operator',{exact:true});await operator.selectOption('on');await expect(rows).toHaveCount(3);
 const onFilter={...filter,conditions:[{...filter.conditions[0],operator:'on'}]};const response=await page.request.get(url+'/api/v1/'+(surface==='search'?'issues':'projects')+'?filter='+encodeURIComponent(JSON.stringify(onFilter)),{headers:{'X-Parabolic-Time-Zone':'America/Los_Angeles'}});expect(response.ok()).toBeTruthy();expect((await response.json()).totalCount).toBe(3);
 if(surface==='projects'){await page.getByRole('button',{name:'Add project view',exact:true}).click();await page.getByRole('menuitem',{name:'Create new view',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New view',exact:true});await dialog.getByLabel('Name',{exact:true}).fill('On date saved project view');await dialog.getByRole('button',{name:'Create view',exact:true}).click();await expect(page.getByRole('link',{name:'On date saved project view',exact:true})).toHaveAttribute('aria-current','page');const savedState=await(await page.request.get(url+'/api/v1/state')).json();expect(savedState.views.find((v:any)=>v.name==='On date saved project view').filters).toEqual(onFilter)}
 if(surface==='search')unavailable=true;await page.reload();if(surface==='search')await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(rows).toHaveCount(3);
 if(surface==='projects'&&!await operator.isVisible())await page.getByRole('button',{name:'Filter projects',exact:true}).click();await expect(operator).toHaveValue('on');
 const property=surface==='search'?page.locator('.filter-condition select').first():page.getByLabel('Project filter 1 property',{exact:true});await property.selectOption('labelIds');await expect(operator).toHaveValue('eq');
 }finally{await page.close();await app.close()}
});
