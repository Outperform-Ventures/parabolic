import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('empty project label groups persist and remain available as project columns',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Groups',email:'groups-ui@example.test',password:'label-password'}});
 await page.goto(url+'/settings/project-labels');await page.getByRole('button',{name:'New group',exact:true}).click();await page.getByLabel('Group name',{exact:true}).fill('Audience');await page.getByLabel('Group name',{exact:true}).press('Enter');let dialog=page.getByRole('dialog');
 const groupRow=page.locator('[data-label-group-id]').filter({hasText:'Audience'});await expect(groupRow).toContainText('0 labels');await page.reload();await expect(groupRow).toBeVisible();
 await page.getByRole('button',{name:'New group',exact:true}).click();await page.getByLabel('Group name',{exact:true}).fill('Audience');await page.getByLabel('Group name',{exact:true}).press('Enter');await expect(page.getByText(/already exists/)).toBeVisible();await page.getByLabel('Group name',{exact:true}).press('Escape');
 await groupRow.getByRole('button',{name:'Add label',exact:true}).click();dialog=page.getByRole('dialog',{name:'Add label to Audience'});await dialog.getByLabel('Label name',{exact:true}).fill('Enterprise');await dialog.getByRole('button',{name:'Create label',exact:true}).click();await expect(groupRow).toContainText('1 label');
 await groupRow.getByRole('button',{name:'Audience',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit label group'});await dialog.getByLabel('Group name',{exact:true}).fill('Market');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(async()=>{const state=await(await page.request.get(url+'/api/v1/state')).json();return state.labels.find((l:any)=>l.name==='Enterprise')?.group}).toBe('Market');
 const state=await(await page.request.get(url+'/api/v1/state')).json(),label=state.labels.find((l:any)=>l.name==='Enterprise');expect((await page.request.delete(url+'/api/v1/labels/'+label.id)).ok()).toBeTruthy();await expect(page.locator('[data-label-group-id]').filter({hasText:'Market'})).toContainText('0 labels');
 await page.goto(url+'/projects');await page.getByRole('button',{name:'Project display options',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Market',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});
