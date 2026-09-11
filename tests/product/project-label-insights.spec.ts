import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('project label Insights slice, segment, drill down and persist',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project Filter',email:'upstream@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const label=await create('labels',{name:'Enterprise',entityType:'projects'});const second=await create('labels',{name:'Large',entityType:'projects'}),project=await create('projects',{name:'Parent',teamIds:[team.id],labelIds:[label.id,second.id]});
 const issue=await create('issues',{title:'Upstream linked',teamId:team.id,projectId:project.id});await create('issues',{title:'Upstream standalone',teamId:team.id});
 await page.goto(url+'/team/'+team.id+'/issues');
 await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(2);
 await page.keyboard.press('Meta+Shift+i');
 const panel=page.getByRole('complementary',{name:'View insights',exact:true});await expect(panel).toBeVisible();
 await panel.getByLabel('Slice',{exact:true}).selectOption('Project label');
 await expect(panel.getByRole('button',{name:'Filter view by Enterprise',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Filter view by Large',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Filter view by No project label',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Filter view by Large',exact:true}).click();
 await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(1);
 await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveAttribute('data-issue-id',issue.id);
 await panel.getByLabel('Segment',{exact:true}).selectOption('Project label');
 await expect(panel.getByRole('button',{name:'Filter Enterprise, Large',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Filter Enterprise, Large',exact:true}).click();
 await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(1);
 await page.reload();await expect(page.locator('.issue-list-scroll [data-issue-id]').first()).toBeVisible();await page.keyboard.press('Meta+Shift+i');await expect(panel.getByLabel('Slice',{exact:true})).toHaveValue('Project label');await expect(panel.getByLabel('Segment',{exact:true})).toHaveValue('Project label');
 const stats=await(await page.request.get(url+'/api/v1/insights?groupBy=projectLabelIds')).json();expect(stats.totalCount).toBe(2);expect(stats.nodes.map((n:any)=>[n.key,n.count]).sort()).toEqual([[label.id,1],[second.id,1],['none',1]].sort());
 }finally{await page.close();await app.close()}
});
