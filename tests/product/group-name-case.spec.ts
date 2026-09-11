import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('lowercase group creation reuses the existing group and replaces its selected sibling',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Case',email:'case@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 const label=await(await page.request.post(url+'/api/v1/labels',{data:{name:'Bug',group:'Type'}})).json(),issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Canonical group',teamId:state.teams[0].id,labelIds:[label.id]}})).json();
 await page.goto(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Change label',exact:true}).click();const menu=page.locator('[data-property-menu="labelIds"]');await menu.locator('input').fill('type/Feature');await menu.getByRole('button',{name:'Create “type/Feature” in Workspace',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json(),created=s.labels.find((l:any)=>l.name==='Feature'),selected=s.issues.find((i:any)=>i.id===issue.id).labelIds;return created&&[created.group,created.labelGroupId,selected.length===1&&selected[0]===created.id,s.labelGroups.length]}).toEqual(['Type',label.labelGroupId,true,1]);
 const latest=await(await page.request.get(url+'/api/v1/state')).json(),created=latest.labels.find((l:any)=>l.name==='Feature');expect(latest.issues.find((i:any)=>i.id===issue.id).labelIds).toEqual([created.id]);await page.reload();await page.getByRole('button',{name:'Change label',exact:true}).click();await expect(menu.getByRole('button',{name:'Feature',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});
