import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('project activity identifies actors and named changes, scopes history, orders edits and updates live',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Activity Owner',email:'activity-owner@example.test',password:'activity-owner-password'}});
 const state=await (await page.request.get(url+'/api/v1/state')).json();
 const create=async(name:string)=>(await (await page.request.post(url+'/api/v1/projects',{data:{name,priority:0,status:'backlog',teamIds:[state.teams[0].id]}})).json());
 const project=await create('Activity project'),blocker=await create('Dependency name');
 const patch=async(data:any)=>{const r=await page.request.patch(url+'/api/v1/projects/'+project.id,{data});expect(r.ok(),await r.text()).toBeTruthy()};
 await patch({priority:2,status:'started',leadId:state.user.id,dependencyIds:[blocker.id]});
 await page.goto(url+'/project/'+project.id+'/activity');const history=page.getByLabel('Project activity',{exact:true});
 await expect(history).toContainText('Created project');await expect(history).toContainText('Activity Owner');await expect(history).toContainText('Priority: No priority → High');await expect(history).toContainText('Status: Backlog → In Progress');await expect(history).toContainText('Lead: Not set → Activity Owner');await expect(history).toContainText('Blocked by: Not set → Dependency name');await expect(history).not.toContainText(blocker.id);
 await patch({name:'Activity renamed',summary:'Latest summary'});await expect(history.locator('[data-project-activity]').first()).toContainText('Summary: Not set → Latest summary');
 await patch({leadId:null,dependencyIds:[]});await expect(history).toContainText('Lead: Activity Owner → Not set');await expect(history).toContainText('Blocked by: Dependency name → Not set');
 await page.reload();await expect(history).toContainText('Latest summary');await expect(history).not.toContainText('History:');expect(await history.locator('[data-project-activity]').count()).toBe(4);
 await page.goto(url+'/project/'+project.id+'/updates');await expect(page.locator('.feature-updates')).toContainText('Priority: No priority → High');
 }finally{await page.close();await app.close()}
});
