import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('issue project-label groups persist and allow subgroup edits without changing parent labels',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project Filter',email:'upstream@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const label=await create('labels',{name:'Enterprise',entityType:'projects'});const unused=await create('labels',{name:'Unused',entityType:'projects'}),project=await create('projects',{name:'Parent',teamIds:[team.id],labelIds:[label.id]});
 const issue=await create('issues',{title:'Upstream linked',teamId:team.id,projectId:project.id,priority:2});await create('issues',{title:'Upstream standalone',teamId:team.id});
 await page.setViewportSize({width:1777,height:991});await page.goto(url+'/team/'+team.id+'/all');
 const display=()=>page.getByRole('button',{name:'Display options',exact:true}).click();
 await display();await page.getByLabel('Grouping',{exact:true}).selectOption('projectLabelIds');await page.keyboard.press('Escape');
 await expect(page.locator('.group-header[data-group-id="'+label.id+'"]')).toContainText('Enterprise');
 await expect(page.locator('.group-header[data-group-id="none"]')).toContainText('No project label');
 await page.reload();await display();await expect(page.getByLabel('Grouping',{exact:true})).toHaveValue('projectLabelIds');
 await page.getByRole('tab',{name:'Board',exact:true}).click();await page.getByLabel('Sub-grouping',{exact:true}).selectOption('priority');await page.keyboard.press('Escape');
 const source=page.locator('.board-card[data-issue-id="'+issue.id+'"]');
 const target=page.locator('.swimlane-cell[data-column-id="'+label.id+'"][data-row-id="1"]');
 await source.dragTo(target);
 await expect.poll(async()=> (await(await page.request.get(url+'/api/v1/issues/'+issue.id)).json()).priority).toBe(1);
 await source.dragTo(page.locator('.swimlane-cell[data-column-id="none"][data-row-id="1"]'));
 await expect(page.getByText('Change the parent project’s labels to move these issues into that group.',{exact:true})).toBeVisible();
 const after=await(await page.request.get(url+'/api/v1/issues/'+issue.id)).json();expect(after.projectId).toBe(project.id);expect(after.projectLabelIds).toBeUndefined();expect(after.labelIds??[]).toEqual([]);
 expect((await(await page.request.get(url+'/api/v1/projects/'+project.id)).json()).labelIds).toEqual([label.id]);
 expect((await page.request.patch(url+'/api/v1/projects/'+project.id,{data:{labelIds:[unused.id]}})).ok()).toBeTruthy();
 await expect(page.locator('.group-header[data-group-id="'+unused.id+'"]')).toContainText('Unused');
 }finally{await page.close();await app.close()}
});
