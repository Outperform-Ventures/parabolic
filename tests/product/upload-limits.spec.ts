import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';
test('file fields use the server bound and accept over 100 files with bounded parallel uploads',async({page})=>{
 test.setTimeout(90000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist'),uploadMaxBytes:16}),{url}=await app.start();let active=0,peak=0,posts=0;
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'File limits',email:'file-limits-ui@example.test',password:'file-limits-ui-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const template=await(await page.request.post(url+'/api/v1/templates',{data:{name:'Many evidence files',teamId:team.id,title:'Many file request',formFields:[{id:'evidence',label:'Evidence',type:'file',required:true}]}})).json();
  await page.route('**/api/v1/attachments',async route=>{if(route.request().method()!=='POST')return route.continue();active++;posts++;peak=Math.max(peak,active);try{await new Promise(resolve=>setTimeout(resolve,20));const response=await route.fetch();await route.fulfill({response});}finally{active--;}});
  await page.goto(url+'/new?team='+team.id+'&template='+template.id);await expect(page.getByText('Server upload limit: 16 bytes per file',{exact:true})).toBeVisible();const input=page.getByLabel('Evidence',{exact:true});
  await input.setInputFiles({name:'oversized.txt',mimeType:'text/plain',buffer:Buffer.alloc(17)});await expect(page.getByRole('alert')).toContainText('server upload limit (16 bytes)');expect(posts).toBe(0);await page.getByRole('button',{name:'Remove oversized.txt',exact:true}).click();
  await input.setInputFiles(Array.from({length:101},(_,index)=>({name:'evidence-'+index+'.txt',mimeType:'text/plain',buffer:Buffer.from('x')})));
  await expect(page.locator('.template-upload li a')).toHaveCount(101,{timeout:30000});expect(posts).toBe(101);expect(peak).toBeLessThanOrEqual(4);expect(peak).toBeGreaterThan(1);
  await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect.poll(async()=>{const rows=await(await page.request.get(url+'/api/v1/issues')).json();return rows.nodes.find((row:any)=>row.title==='Many file request')?.templateAnswers?.evidence?.length}).toBe(101);
 }finally{await page.close();await app.close()}
});
