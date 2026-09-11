import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('template-only placeholder formatting persists and creation links keep the chosen child team',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'template-mode@example.test',name:'Owner',password:'template-mode-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json()};
  const state=await(await page.request.get(url+'/api/v1/state')).json(),parent=state.teams[0],child=await create('teams',{name:'Child team',key:'CHD',parentId:parent.id}),template=await create('templates',{name:'Prompt template',type:'issue',teamId:parent.id,description:'<p>Describe the problem</p>',properties:{teamId:parent.id}});
  await page.goto(url+'/settings/templates?template='+template.id);
  const dialog=page.getByRole('dialog',{name:'Edit template',exact:true}),editor=dialog.locator('.ProseMirror').first();await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.getByRole('button',{name:'Placeholder text',exact:true}).click();
  await expect(editor.locator('[data-type="template-placeholder"]')).toHaveText('Describe the problem');
  await dialog.getByRole('button',{name:'Save template',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.goto(url+'/new?team='+child.id+'&template='+template.id+'&title=Child%20request');
  const composer=page.locator('.issue-composer');await expect(page.locator('.issue-title-input')).toHaveValue('Child request');
  await expect(page.locator('.ProseMirror [data-type="template-placeholder"]')).toHaveText('Describe the problem');
  await expect(page.getByRole('button',{name:'Placeholder text',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Create issue',exact:true}).click();
  await expect.poll(async()=>{const response=await page.request.get(url+'/api/v1/issues');const result=await response.json();return result.nodes.find((issue:any)=>issue.title==='Child request')?.teamId}).toBe(child.id);
  const saved=await(await page.request.get(url+'/api/v1/issues')).json();expect(saved.nodes.find((issue:any)=>issue.title==='Child request').description).not.toContain('Describe the problem');
  await page.goto(url+'/new?team='+child.id+'&template='+template.id+'&title=Filled%20request');await page.locator('.issue-composer .ProseMirror').fill('The save button fails');await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect.poll(async()=>{const rows=await(await page.request.get(url+'/api/v1/issues')).json();return rows.nodes.find((issue:any)=>issue.title==='Filled request')?.description}).toContain('The save button fails');
  const retained=await(await page.request.get(url+'/api/v1/templates/'+template.id)).json();expect(retained.description).toContain('Describe the problem');expect(retained.description).toContain('template-placeholder');
 }finally{await app.close()}
});
