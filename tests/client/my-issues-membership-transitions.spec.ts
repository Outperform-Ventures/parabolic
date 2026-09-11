import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
for(const tab of ['Assigned','Created','Subscribed','Activity'])test(`My ${tab} clears last-row selection on live removal and recovers after reload`,async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Membership owner',email:'membership@example.test',password:'membership-test-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 await page.goto(url+'/my-issues?tab='+tab);await expect(page.getByTestId('issue-row')).toHaveCount(0);await expect(page.getByRole('heading',{name:'No issues',exact:true})).toBeVisible();
 const response=await page.request.post(url+'/api/v1/issues',{data:{title:'Live personal membership',teamId:state.teams[0].id,assigneeId:state.user.id}});expect(response.ok(),await response.text()).toBeTruthy();const issue=await response.json();
 if(tab==='Subscribed'){const sub=await page.request.post(url+'/api/v1/subscriptions',{data:{issueId:issue.id,userId:state.user.id}});expect(sub.ok(),await sub.text()).toBeTruthy();}
 const row=page.getByTestId('issue-row');await expect(row).toHaveCount(1);await row.hover();await page.keyboard.press('x');await expect(page.locator('.selection-toolbar')).toBeVisible();
 if(tab==='Assigned')await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{assigneeId:null}});
 else if(tab==='Subscribed'){const current=await(await page.request.get(url+'/api/v1/state')).json();for(const sub of current.subscriptions.filter((s:any)=>(s.issueId===issue.id||s.entityId===issue.id)&&s.userId===state.user.id&&!s.deletedAt))await page.request.delete(url+'/api/v1/subscriptions/'+sub.id);await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{subscriberIds:[]}});}
 else await page.request.delete(url+'/api/v1/issues/'+issue.id);
 await expect(row).toHaveCount(0);await expect(page.getByRole('heading',{name:'No issues',exact:true})).toBeVisible();await expect(page.locator('.selection-toolbar')).toHaveCount(0);
 await page.reload();await expect(row).toHaveCount(0);if(tab==='Assigned'){await page.goto(url+'/my-issues?tab=Created');await expect(row).toHaveCount(1);await page.goto(url+'/my-issues?tab=Assigned');await page.request.patch(url+'/api/v1/issues/'+issue.id,{data:{assigneeId:state.user.id}});await expect(row).toHaveCount(1);}
 }finally{await page.close();await app.close();}
});
