import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project overview rail exposes native section controls and recent activity',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Rail owner',email:'overview-rail@example.test',password:'overview-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0],project=await page.request.post(url+'/api/v1/projects',{data:{name:'Native overview rail',teamIds:[team.id],teamId:team.id,status:'started'}}).then(response=>response.json());
  const milestone=await page.request.post(url+'/api/v1/milestones',{data:{name:'First milestone',projectId:project.id,position:0}}).then(response=>response.json());
  await page.goto(url+'/project/'+project.id+'/overview');
  const rail=page.getByRole('complementary',{name:'Project details',exact:true});
  const milestones=rail.getByRole('button',{name:'Collapse milestones section',exact:true}),progress=rail.getByRole('button',{name:'Collapse progress section',exact:true}),activity=rail.getByRole('button',{name:'Collapse activity section',exact:true});
  for(const toggle of [milestones,progress,activity])await expect(toggle).toHaveAttribute('aria-expanded','true');
  const addDependency=rail.getByRole('button',{name:'Add dependency',exact:true});await expect(addDependency).toBeVisible();
  expect(await rail.locator('.project-properties-card-body').evaluate(element=>element.textContent!.indexOf('Add dependency')<element.textContent!.indexOf('Status'))).toBe(true);
  await expect(rail.getByRole('link',{name:'First milestone',exact:true})).toBeVisible();
  const milestoneRow=rail.locator(`[data-planning-milestone="${milestone.id}"]`);await expect(milestoneRow).toHaveRole('button');await expect(milestoneRow).toHaveAttribute('aria-label',/First milestone 0% of 0 Milestone actions/);
  const preview=rail.getByRole('region',{name:'Project sidebar activity',exact:true});await expect(preview).toContainText('Rail owner');await expect(preview).toContainText('created the project');
  await expect(preview.getByRole('link',{name:'See all',exact:true})).toHaveAttribute('href','/project/'+project.id+'/activity');
  await milestones.click();await expect(rail.getByRole('button',{name:'Expand milestones section',exact:true})).toHaveAttribute('aria-expanded','false');await expect(rail.getByRole('link',{name:'First milestone',exact:true})).toHaveCount(0);
  await progress.click();await expect(rail.getByRole('button',{name:'Expand progress section',exact:true})).toHaveAttribute('aria-expanded','false');await expect(rail.getByRole('img',{name:/project progress over time/i})).toHaveCount(0);
  await activity.click();await expect(rail.getByRole('button',{name:'Expand activity section',exact:true})).toHaveAttribute('aria-expanded','false');await expect(preview).not.toContainText('created the project');
  await rail.getByRole('button',{name:'Expand milestones section',exact:true}).click();await milestoneRow.focus();await milestoneRow.press('Enter');await expect(page).toHaveURL(url+'/project/'+project.id+'/issues?milestone='+milestone.id);
 }finally{await page.close();await app.close()}
});
