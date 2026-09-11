import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('project progress uses the native smooth curve, direct trajectories, fill, and endpoints',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Progress grammar',email:'progress-grammar@example.test',password:'progress-password'}});
  const data=await(await page.request.get(url+'/api/v1/state')).json(),team=data.teams[0],actor:any={userId:data.user.id,workspaceId:data.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-08-01T12:00:00Z')};
  const project=app.repo.create(actor,'projects',{name:'Native progress grammar',teamIds:[team.id],teamId:team.id,status:'started',startDate:'2026-08-01'}),status=(type:string)=>data.statuses.find((row:any)=>row.teamId===team.id&&row.type===type).id;
  actor.now=new Date('2026-08-05T12:00:00Z');app.repo.create(actor,'issues',{title:'Open scope',teamId:team.id,projectId:project.id,statusId:status('unstarted'),estimate:5});
  actor.now=new Date('2026-08-18T12:00:00Z');app.repo.create(actor,'issues',{title:'Started scope',teamId:team.id,projectId:project.id,statusId:status('started'),estimate:3,startedAt:'2026-08-18T12:00:00Z'});
  actor.now=new Date('2026-09-01T12:00:00Z');app.repo.create(actor,'issues',{title:'Completed scope',teamId:team.id,projectId:project.id,statusId:status('completed'),estimate:2,startedAt:'2026-08-25T12:00:00Z',completedAt:'2026-09-01T12:00:00Z'});
  await page.goto(url+'/project/'+project.id);
  const chart=page.locator('.project-progress-graph'),svg=chart.getByRole('img',{name:/project progress over time/});await expect(svg).toBeVisible();
  await expect(svg.locator('[data-progress-series="scope"]')).toHaveAttribute('d',/ C/);
  for(const series of ['started','completed']){const d=await svg.locator(`[data-progress-series="${series}"]`).getAttribute('d');expect(d).toMatch(/^M[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+$/);}
  await expect(svg.locator('[data-progress-fill="completed"]')).toHaveAttribute('fill',/^url\(#project-progress-fill-/);
  await expect(svg.locator('[data-progress-endpoint]')).toHaveCount(2);await expect(svg.locator('[data-progress-current="true"]')).toHaveCount(1);await expect(svg.locator('[data-progress-now-tail="true"]')).toHaveCount(1);
  await expect(svg.locator('line[stroke-width="16"]')).toHaveCount(0);
  const bounds=await svg.boundingBox();expect(bounds).toBeTruthy();await svg.dispatchEvent('mousemove',{clientX:bounds!.x+bounds!.width*.65,clientY:bounds!.y+bounds!.height*.5});await expect(chart.locator('.feature-graph-tooltip')).toBeVisible();
 }finally{await page.close();await app.close()}
});
