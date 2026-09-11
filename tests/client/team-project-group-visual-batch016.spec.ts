import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test.use({serviceWorkers:'block',colorScheme:'dark'});

test('Project-grouped Team rows use the project icon once and retain badges in other grouping modes',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project grouping owner',email:'project-grouping@example.test',password:'project-grouping-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Native project group',teamId:team.id,teamIds:[team.id],icon:'Stadium',color:'#7880ed'}})).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Grouped project issue',teamId:team.id,projectId:project.id}})).json();
  const properties=['identifier','statusId','priority','projectId'];
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{displayDefaults:{all:{layout:'list',groupCount:'issues',groupBy:'projectId',subGroupBy:'none',orderBy:'priority',direction:'asc',showCompleted:true,showEmpty:false,showSubIssues:true,nestedSubIssues:true,properties}}}});
  await page.setViewportSize({width:1777,height:991});
  await page.goto(url+'/team/'+team.id+'/all');

  const row=page.locator(`[data-testid="issue-row"][data-issue-id="${issue.id}"]`);
  const projectGroup=page.locator(`.group-header[data-group-field="projectId"][data-group-id="${project.id}"]`);
  await expect(projectGroup).toBeVisible();
  const projectIcon=projectGroup.locator('[data-entity-icon="Stadium"]');
  await expect(projectIcon).toHaveCount(1);
  await expect(projectIcon).toHaveAttribute('width','16');
  await expect(projectIcon).toHaveAttribute('height','16');
  await expect(projectGroup.locator('.group-color-dot')).toHaveCount(0);
  await expect(row.locator('.issue-project-badge')).toHaveCount(0);

  await page.getByRole('button',{name:'Display options',exact:true}).click();
  await page.getByLabel('Grouping',{exact:true}).selectOption('statusId');
  await page.keyboard.press('Escape');
  await expect(row.locator('.issue-project-badge')).toHaveCount(1);
  await expect(row.locator('.issue-project-badge')).toContainText('Native project group');
 }finally{await page.close();await app.close()}
});
