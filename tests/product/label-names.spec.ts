import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('reserved names stay out of offline edits and label creation can recover',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Names',email:'names@example.test',password:'label-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
 const label=await(await page.request.post(url+'/api/v1/labels',{data:{name:'Editable'}})).json(),issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Label naming',teamId:state.teams[0].id}})).json();
 await page.goto(url+'/settings/labels');const row=page.locator('[data-label-id="'+label.id+'"]');await row.getByRole('button',{name:'Editable',exact:true}).click();
 await page.context().setOffline(true);await page.getByLabel('Label name',{exact:true}).fill('Priority');await page.getByLabel('Label name',{exact:true}).press('Enter');
 await expect(page.getByText('“Priority” is reserved for an issue property. Choose another label name.',{exact:true})).toBeVisible();await expect(page.getByLabel('Label name',{exact:true})).toHaveValue('Priority');await expect(page.getByLabel('Label name',{exact:true})).toBeFocused();
 const queued=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open('parabolic-client');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('outbox'),count=tx.objectStore('outbox').count();count.onsuccess=()=>resolve(count.result);tx.oncomplete=()=>db.close()}}));expect(queued).toBe(0);
 await page.keyboard.press('Escape');await page.context().setOffline(false);await page.goto(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Change label',exact:true}).click();const menu=page.locator('[data-property-menu="labelIds"]');await menu.locator('input').fill('Type/Status');await menu.getByRole('button',{name:'Create “Type/Status” in Workspace',exact:true}).click();await expect(menu.getByRole('alert')).toContainText('reserved');
 await menu.locator('input').fill('Type/Work state');await menu.getByRole('button',{name:'Create “Type/Work state” in Workspace',exact:true}).click();await expect(menu.getByRole('alert')).toHaveCount(0);
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();return s.labels.some((l:any)=>l.name==='Work state')}).toBe(true);
 expect((await(await page.request.get(url+'/api/v1/labels/'+label.id)).json()).name).toBe('Editable');
 }finally{await page.context().setOffline(false);await page.close();await app.close()}
});
