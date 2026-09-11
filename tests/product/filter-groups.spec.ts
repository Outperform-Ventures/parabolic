import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';
for(const kind of ['issues','projects'])test(`${kind} nested group controls preserve matching and URL state`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Group Editor',email:'group-editor@example.test',password:'group-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 for(const name of ['Alpha scoped','Beta scoped','Gamma scoped','Alpha outside']){const r=await page.request.post(url+'/api/v1/'+kind,{data:kind==='issues'?{title:name,teamId:team.id}:{name,teamIds:[team.id]}});expect(r.ok()).toBeTruthy()}
 const field=kind==='issues'?'title':'name',initial={conditions:[{field,operator:'contains',value:'scoped'}],match:'all'},base=url+'/team/'+team.id+'/'+(kind==='issues'?'all':'projects');
 await page.goto(base+'?filter='+encodeURIComponent(JSON.stringify(initial)));
 const rows=kind==='issues'?page.locator('.issue-row'):page.locator('.feature-project-table tbody tr');await expect(rows).toHaveCount(3);
 const open=()=>page.getByRole('button',{name:kind==='issues'?'Filter issues':'Filter projects',exact:true}).click();await open();
 await page.getByRole('button',{name:'Add filter group',exact:true}).click();
 const group=page.locator('.filter-group').first();await expect(group).toBeVisible();
 await page.reload();await open();await expect(group).toBeVisible();await expect(rows).toHaveCount(3);
 await group.getByRole('button',{name:'Add filter',exact:true}).click();
 const condition=group.locator('.filter-condition').first();await condition.locator('select').nth(0).selectOption(field);await condition.locator('select').nth(1).selectOption('contains');await condition.locator('input').fill('Alpha');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha scoped');
 await group.getByRole('button',{name:'Add filter',exact:true}).click();const second=group.locator('.filter-condition').nth(1);await second.locator('select').nth(0).selectOption(field);await second.locator('select').nth(1).selectOption('contains');await second.locator('input').fill('Beta');await expect(rows).toHaveCount(0);
 await group.locator('.filter-builder-head select').first().selectOption('any');await expect(rows).toHaveCount(2);
 await group.getByRole('button',{name:'Add filter group',exact:true}).click();const nested=group.locator('.filter-group');await nested.getByRole('button',{name:'Add filter',exact:true}).click();const third=nested.locator('.filter-condition');await third.locator('select').nth(0).selectOption(field);await third.locator('select').nth(1).selectOption('contains');await third.locator('input').fill('Gamma');await expect(rows).toHaveCount(3);
 const filter=JSON.parse(new URL(page.url()).searchParams.get('filter')!);expect(filter.groups[0].groups[0].conditions[0].value).toBe('Gamma');await page.reload();await expect(rows).toHaveCount(3);
 const savedResponse=await page.request.post(url+'/api/v1/views',{data:{name:'Grouped saved view',entityType:kind,filters:filter}});expect(savedResponse.ok()).toBeTruthy();const saved=await savedResponse.json();await page.goto(url+'/view/'+saved.id);await expect(rows).toHaveCount(3);await open();
 await page.locator('.filter-group').first().locator(':scope > button').click();await expect(page.locator('.filter-group')).toHaveCount(0);await expect(rows).toHaveCount(3);
 expect((await(await page.request.get(url+'/api/v1/views/'+saved.id)).json()).filters).toEqual(filter);
 }finally{await page.close();await app.close()}
});
test('group-only search agrees with API and Insights and falls back to the cached worker',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();let unavailable=false,blocked=0;const listeners=app.server.listeners('request');app.server.removeAllListeners('request');app.server.on('request',(req,res)=>{if(unavailable&&req.url?.startsWith('/api/v1/search?')){blocked++;req.socket.destroy()}else for(const listener of listeners)listener.call(app.server,req,res)});
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Group Search',email:'group-search@example.test',password:'group-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 for(const [title,priority]of [['Alpha retained',1],['Beta retained',2],['Gamma excluded',3]] as const)await page.request.post(url+'/api/v1/issues',{data:{title,priority,teamId:state.teams[0].id}});
 const filter={conditions:[],match:'all',groups:[{conditions:[{field:'priority',operator:'eq',value:1},{field:'priority',operator:'eq',value:2}],match:'any'}]},encoded=encodeURIComponent(JSON.stringify(filter));
 for(const endpoint of ['/api/v1/issues?filter=','/api/v1/search?kinds=issues&filter=']){const r=await page.request.get(url+endpoint+encoded);expect(r.ok()).toBeTruthy();expect((await r.json()).nodes).toHaveLength(2)}
 const insight=await page.request.get(url+'/api/v1/insights?filter='+encoded);expect(insight.ok()).toBeTruthy();expect((await insight.json()).totalCount).toBe(2);
 await page.goto(url+'/search?type=Issues&filter='+encoded);const results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');await expect(results).toHaveCount(2);await expect(results.nth(0)).toContainText('retained');
 unavailable=true;await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(2);expect(blocked).toBeGreaterThan(0);
 await page.locator('.filter-builder-head select').nth(1).selectOption('all');await expect(results).toHaveCount(0);
 await page.goto(url+'/search?type=Issues&filter='+encodeURIComponent(JSON.stringify({conditions:[],groups:[null]})));await expect(page.getByRole('combobox',{name:'Search workspace content',exact:true})).toBeVisible();await expect(page.locator('.filter-group')).toHaveCount(0);await expect(results).toHaveCount(0);
 }finally{await page.close();await app.close()}
});
