import {test,expect} from '@playwright/test';import{resolve}from'node:path';import{createApp}from'../../src/server/app';
for(const kind of ['issues','projects'])test(`${kind} temporary filters survive reload and history without escaping team scope`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Route Reader',email:'route-reader@example.test',password:'route-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};const other=await create('teams',{name:'Other route team',key:'OTHER'});
 for(const [name,teamId]of [['Alpha scoped',team.id],['Beta scoped',team.id],['Alpha elsewhere',other.id]])await create(kind,kind==='issues'?{title:name,teamId}:{name,teamIds:[teamId]});
 const field=kind==='issues'?'title':'name',filter=(value:string)=>({conditions:[{field,operator:'contains',value}],match:'all'}),base=url+'/team/'+team.id+'/'+(kind==='issues'?'all':'projects'),link=(value:string)=>base+'?panel=kept&filter='+encodeURIComponent(JSON.stringify(filter(value)))+'#kept';
 const rows=kind==='issues'?page.locator('.issue-row'):page.locator('.feature-project-table tbody tr');
 await page.goto(link('Alpha'));await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha scoped');await page.reload();await expect(rows).toHaveCount(1);
 await page.goto(link('Beta'));await expect(rows).toHaveCount(1);await expect(rows).toContainText('Beta scoped');await page.goBack();await expect(rows).toContainText('Alpha scoped');await page.goForward();await expect(rows).toContainText('Beta scoped');
 await page.getByRole('button',{name:kind==='issues'?'Filter issues':'Filter projects',exact:true}).click();await page.locator('.filter-builder').getByRole('button',{name:'Clear filters',exact:true}).click();await expect(rows).toHaveCount(2);const changed=new URL(page.url());expect(changed.searchParams.get('panel')).toBe('kept');expect(changed.hash).toBe('#kept');expect(JSON.parse(changed.searchParams.get('filter')!).conditions).toEqual([]);
 await page.reload();await expect(rows).toHaveCount(2);await page.goto(base+'?filter='+encodeURIComponent('{"conditions":[null]}'));await expect(rows).toHaveCount(2);await expect(page.locator('.workspace-shell')).toBeVisible();
 }finally{await page.close();await app.close()}
});
for(const kind of ['issues','projects'])test(`${kind} URL override and explicit clearing leave saved defaults unchanged`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Saved Route',email:'saved-route@example.test',password:'route-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};for(const name of ['Alpha saved','Beta override'])await create(kind,kind==='issues'?{title:name,teamId:team.id}:{name,teamIds:[team.id]});
 const field=kind==='issues'?'title':'name',filter=(value:string)=>({conditions:[{field,operator:'contains',value}],match:'all'}),defaults=filter('Alpha'),view=await create('views',{name:'Saved route default',entityType:kind,filters:defaults}),base=url+'/view/'+view.id;
 const rows=kind==='issues'?page.locator('.issue-row'):page.locator('.feature-project-table tbody tr');await page.goto(base);await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha saved');
 await page.goto(base+'?filter='+encodeURIComponent(JSON.stringify(filter('Beta'))));await expect(rows).toHaveCount(1);await expect(rows).toContainText('Beta override');await page.reload();await expect(rows).toContainText('Beta override');
 await page.getByRole('button',{name:kind==='issues'?'Filter issues':'Filter projects',exact:true}).click();await page.locator('.filter-builder').getByRole('button',{name:'Clear filters',exact:true}).click();await expect(rows).toHaveCount(2);await page.reload();await expect(rows).toHaveCount(2);
 expect((await(await page.request.get(url+'/api/v1/views/'+view.id)).json()).filters).toEqual(defaults);await page.goto(base);await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha saved');
 }finally{await page.close();await app.close()}
});

for(const kind of ['issues','projects'])test(`${kind} open saved view follows changed defaults while retaining a URL override`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Live Default',email:'live-default@example.test',password:'live-default-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json()};for(const name of ['Alpha default','Beta changed','Gamma override'])await create(kind,kind==='issues'?{title:name,teamId:team.id}:{name,teamIds:[team.id]});
 const field=kind==='issues'?'title':'name',filter=(value:string)=>({conditions:[{field,operator:'contains',value}],match:'all'}),view=await create('views',{name:'Live saved filter',entityType:kind,filters:filter('Alpha')}),base=url+'/view/'+view.id;
 const rows=kind==='issues'?page.locator('.issue-row'):page.locator('.feature-project-table tbody tr');await page.goto(base);await expect(rows).toHaveCount(1);await expect(rows).toContainText('Alpha default');
 const change=async(name:string,value:string)=>{const r=await page.request.patch(url+'/api/v1/views/'+view.id,{data:{name,filters:filter(value)}});expect(r.ok()).toBeTruthy();await expect(page.getByText(name,{exact:true}).first()).toBeVisible()};
 await change('Changed default','Beta');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Beta changed');
 await page.goto(base+'?filter='+encodeURIComponent(JSON.stringify(filter('Gamma'))));await expect(rows).toContainText('Gamma override');await change('Override retained','Alpha');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Gamma override');
 await page.getByRole('button',{name:kind==='issues'?'Filter issues':'Filter projects',exact:true}).click();await page.locator('.filter-builder').getByRole('button',{name:'Clear filters',exact:true}).click();await expect(rows).toHaveCount(3);await change('Cleared override retained','Beta');await expect(rows).toHaveCount(3);
 await page.goto(base);await expect(rows).toHaveCount(1);await expect(rows).toContainText('Beta changed');
 }finally{await page.close();await app.close()}
});
