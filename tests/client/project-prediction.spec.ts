import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('project graph displays native weighted forecast and clears it for completed work',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Forecast QA',email:'forecast-ui@example.test',password:'forecast-ui-password'}});
  const data=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:data.user.id,workspaceId:data.workspaceId,role:'owner',scopes:['admin']},team=data.teams[0];
  const project=app.repo.create(actor,'projects',{name:'Forecast history',status:'started',teamIds:[team.id]});
  app.repo.save('projects',{...project,createdAt:'2026-01-01T00:00:00Z',startedAt:'2026-01-01T00:00:00Z',completedScopeHistory:[2,8],issueCountHistory:[2,3]},'update',actor);
  for(const [type,estimate]of [['completed',8],['started',4],['unstarted',4]] as const){const status=data.statuses.find((s:any)=>s.teamId===team.id&&s.type===type);app.repo.create(actor,'issues',{teamId:team.id,projectId:project.id,title:type+' effort',statusId:status.id,estimate});}
  await page.goto(url+'/project/'+project.id);
  const forecast=page.locator('.feature-graph-prediction');await expect(forecast).toBeVisible();await expect(forecast).toContainText('4.0 points/week');
  const expected=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+12.25);return date.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});});
  await expect(forecast.locator('strong')).toHaveText(expected);await page.reload();await expect(forecast).toContainText('4.0 points/week');
  app.repo.update(actor,'projects',project.id,{status:'completed'});await page.reload();await expect(forecast).toHaveCount(0);
 }finally{await page.close();await app.close();}
});
