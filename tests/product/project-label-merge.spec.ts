import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('saved upstream filters survive project label merge and deletion',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project Filter',email:'upstream@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const label=await create('labels',{name:'Enterprise',entityType:'projects'}),project=await create('projects',{name:'Parent',teamIds:[team.id],labelIds:[label.id]});
 const issue=await create('issues',{title:'Upstream linked',teamId:team.id,projectId:project.id});await create('issues',{title:'Upstream standalone',teamId:team.id});
 const filter={match:'all',conditions:[{field:'projectLabelIds',operator:'eq',value:label.id}]},view=await create('views',{name:'Upstream view',entityType:'issues',filters:filter});
 await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText(issue.title);
 const target=await create('labels',{name:'Retained',entityType:'projects'});
 expect((await page.request.patch(url+'/api/v1/labels/'+label.id,{data:{mergeIntoId:target.id}})).ok()).toBeTruthy();
 await expect(page.locator('.issue-row')).toHaveCount(1);await page.reload();await expect(page.locator('.issue-row')).toHaveCount(1);
 const saved=await(await page.request.get(url+'/api/v1/views/'+view.id)).json();expect(saved.filters.conditions[0].value).toBe(target.id);
 const search=url+'/search?q=Upstream&type=issues&filter='+encodeURIComponent(JSON.stringify(filter)),results=page.getByRole('listbox',{name:'Search results',exact:true}).getByRole('option');
 await page.goto(search);await expect(results).toHaveCount(1);await expect(results).toContainText(issue.title);
 await page.route('**/api/v1/search?**',route=>route.abort());await page.reload();await expect(page.locator('.search-result-count')).toContainText('Cached');await expect(results).toHaveCount(1);
 expect((await page.request.delete(url+'/api/v1/labels/'+target.id)).ok()).toBeTruthy();await expect(results).toHaveCount(0);
 await page.goto(url+'/view/'+view.id);await expect(page.locator('.issue-row')).toHaveCount(0);
 }finally{await page.close();await app.close()}
});
