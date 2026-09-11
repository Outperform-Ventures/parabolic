import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project detail uses native header tabs and compact issue command placement',async({page})=>{
 const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.setViewportSize({width:1777,height:991});
  await page.request.post(url+'/auth/setup',{data:{name:'Project detail QA',email:'project-detail-batch12@example.test',password:'project-detail-password'}});const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0],project=await page.request.post(url+'/api/v1/projects',{data:{name:'Native detail project',teamIds:[team.id],status:'planned'}}).then(r=>r.json()),status=state.statuses.find((item:any)=>item.teamId===team.id&&item.type==='started')||state.statuses.find((item:any)=>item.teamId===team.id);
  const issue=await page.request.post(url+'/api/v1/issues',{data:{title:'Estimated project issue',teamId:team.id,projectId:project.id,statusId:status.id,estimate:4}}).then(r=>r.json());
  const milestone=await page.request.post(url+'/api/v1/milestones',{data:{name:'Project launch',projectId:project.id,position:0}}).then(r=>r.json());
  const milestoneIssue=await page.request.post(url+'/api/v1/issues',{data:{title:'Milestone project issue',teamId:team.id,projectId:project.id,milestoneId:milestone.id,statusId:status.id,estimate:2}}).then(r=>r.json());
  await page.goto(url+'/project/'+project.id+'/issues');
  const header=page.locator('.project-detail-header');await expect(header).toContainText(project.name);await expect(header.getByRole('link',{name:'Projects',exact:true})).toHaveCount(0);expect(await header.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).toEqual(['Add to favorites','Project actions','Copy page URL','Setup project notifications']);
  const tabs=page.getByRole('navigation',{name:'Page views'});expect(await tabs.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')||node.textContent))).toEqual(['Overview','Activity','Issues','Add new view']);
  const toolbar=page.locator('.project-scoped-issues>.view-toolbar');expect(await toolbar.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).toEqual(['Filter issues','Display options','Close project details']);await expect(toolbar.getByText('New issue',{exact:true})).toHaveCount(0);await expect(toolbar.getByRole('button',{name:'Toggle insights'})).toHaveCount(0);
  const tabBox=await tabs.boundingBox(),toolbarBox=await toolbar.boundingBox();expect(toolbarBox!.y).toBeCloseTo(tabBox!.y,2);expect(toolbarBox!.x).toBeCloseTo(1664,0);
  const row=page.locator(`[data-issue-id="${issue.id}"]`);await expect(row).toBeVisible();await expect(row.locator('.issue-project-badge')).toHaveCount(0);await expect(row.locator('.issue-estimate')).toContainText('4');
  const details=page.getByRole('complementary',{name:'Project details'}),properties=details.locator('.feature-properties-card').first();await expect(details.getByText('Slack',{exact:true})).toBeVisible();await expect(details.getByRole('button',{name:'Slack channel'})).toHaveText('Slack channel');await expect(details.getByRole('button',{name:'Labels'})).toHaveText('Add label');await expect(details.getByRole('link',{name:'No milestone'})).toBeVisible();
  const groupBox=await page.locator('.group-header').first().boundingBox(),detailsBox=await details.boundingBox(),propertiesBox=await properties.boundingBox();expect(groupBox!.x).toBeCloseTo(253,0);expect(groupBox!.x+groupBox!.width).toBeCloseTo(1360,0);expect(detailsBox!.x).toBeCloseTo(1364,0);expect(propertiesBox!.x).toBeCloseTo(1372,0);expect(propertiesBox!.width).toBeCloseTo(388,0);
  await details.getByRole('link',{name:'No milestone'}).click();await expect(page).toHaveURL(new RegExp(`/project/${project.id}/issues\\?milestone=none$`));await expect(page.locator(`[data-issue-id="${issue.id}"]`)).toBeVisible();await expect(page.locator(`[data-issue-id="${milestoneIssue.id}"]`)).toHaveCount(0);
  await details.getByRole('button',{name:'Slack channel'}).click();await expect(page).toHaveURL(/\/settings\/integrations$/);
 }finally{await page.close();await app.close()}
});
