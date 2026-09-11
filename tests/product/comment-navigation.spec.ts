import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('comment permalink reveals a hidden resolved reply and hover reply targets its thread',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Comment owner',email:'comment-link@example.test',password:'test-password'}});
 const state=await page.request.get(url+'/api/v1/state').then(r=>r.json());
 const issue=await page.request.post(url+'/api/v1/issues',{data:{teamId:state.teams[0].id,title:'Comment navigation'}}).then(r=>r.json());
 const root=await page.request.post(url+'/api/v1/comments',{data:{issueId:issue.id,body:'Root discussion'}}).then(r=>r.json());
 const reply=await page.request.post(url+'/api/v1/comments',{data:{issueId:issue.id,parentId:root.id,body:'Hidden reply'}}).then(r=>r.json());
 await page.request.patch(url+'/api/v1/comments/'+root.id,{data:{resolved:true}});
 await page.goto(url+'/issues/'+issue.id);await expect(page.locator('#comment-'+root.id)).toBeVisible();await expect(page.locator('#comment-'+reply.id)).toHaveCount(0);
 await page.goto(url+'/issues/'+issue.id+'#comment-'+reply.id);await expect(page.locator('#comment-'+reply.id)).toBeInViewport();
 await page.locator('#comment-'+reply.id).hover();const action=page.locator('#comment-'+reply.id).getByRole('button',{name:'Reply to comment',exact:true});await expect(action).toHaveCSS('opacity','1');await action.click();await expect(page.locator('.comment-composer')).toBeVisible();
 await page.locator('.comment-composer [contenteditable=true]').fill('Reply from hover action');await page.getByRole('button',{name:'Submit comment',exact:true}).click();
 await expect.poll(async()=>{const data=await page.request.get(url+'/api/v1/state').then(r=>r.json());return data.comments.find((c:any)=>JSON.stringify(c.body).includes('Reply from hover action'))?.parentId;}).toBe(root.id);
 await page.reload();await expect(page.getByText('Reply from hover action',{exact:true})).toBeVisible();
 }finally{await page.close();await app.close();}
});
