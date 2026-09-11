import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('issue properties retain editing with native project and nested milestone presentation',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'properties@example.test',password:'properties-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
  const project=await page.request.post(url+'/api/v1/projects',{data:{name:'Property project',teamIds:[team.id],icon:'Stadium',color:'#7880ed'}}).then(r=>r.json());
  const milestone=await page.request.post(url+'/api/v1/milestones',{data:{name:'First delivery',projectId:project.id}}).then(r=>r.json());
  const issue=await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Property issue',projectId:project.id,estimate:3,description:'Persisted description'}}).then(r=>r.json());
  await page.goto(url+'/issues/'+issue.id);const panel=page.locator('.issue-properties-panel');
  await expect(page.locator('.tiptap').first()).toContainText('Persisted description');
  await expect(panel.locator('[data-property=estimate]')).toHaveText('3 Points');
  await expect(panel.locator('[data-property=labelIds]')).toHaveText('Add label');
  await expect(panel.locator('[data-property=projectId]')).toHaveText('Property project');
  await expect(panel.getByRole('heading',{name:'Milestone',exact:true})).toHaveCount(0);
  await expect(panel.locator('.issue-detail-milestone')).toHaveCSS('padding-left','23px');
  await expect(panel.locator('[data-property=milestoneId]')).toHaveText('Set milestone');
  await panel.locator('[data-property=milestoneId]').click();await page.getByRole('option',{name:'First delivery',exact:true}).click();
  await expect(panel.locator('[data-property=milestoneId]')).toHaveText('First delivery');
  await expect.poll(async()=>(await page.request.get(url+'/api/v1/issues/'+issue.id).then(r=>r.json())).milestoneId).toBe(milestone.id);
  await expect(panel.locator('.issue-metadata')).toBeHidden();
  const connector=panel.locator('.issue-milestone-connector');await expect(connector).toBeVisible();
  expect((await connector.boundingBox())!.width).toBe(10);
  await panel.locator('[data-property=projectId]').hover();
  await expect(panel.getByRole('link',{name:'Open project',exact:true})).toHaveCSS('opacity','1');
  await panel.getByRole('link',{name:'Open project',exact:true}).click();
  await expect(page).toHaveURL(url+'/project/'+project.id+'/overview');
 }finally{await page.close();await app.close()}
});
