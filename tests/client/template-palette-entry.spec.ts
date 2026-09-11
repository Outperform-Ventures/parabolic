import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('issue, document and project template command routes open correctly typed editable templates',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'palette-templates@example.test',name:'Owner',password:'palette-template-password'}});
  for(const type of ['issue','document','project']){
   await page.goto(url+'/settings/templates?new='+type);const editor=type==='issue'?page.getByRole('region',{name:'New template',exact:true}):type==='project'?page.getByRole('region',{name:'New project template',exact:true}):page.getByRole('dialog',{name:'New template',exact:true});if(type==='document')await expect(editor.getByLabel('Template type',{exact:true})).toHaveValue(type);await editor.getByLabel('Template name',{exact:true}).fill('Palette '+type);await editor.getByRole('button',{name:type==='issue'?'Create':type==='project'?'Create':'Create template',exact:true}).click();await expect(editor).toHaveCount(0);await expect.poll(async()=>{const result=await(await page.request.get(url+'/api/v1/templates')).json();return result.nodes.find((template:any)=>template.name==='Palette '+type)?.type}).toBe(type);
  }
  await page.goto(url+'/settings/templates?new=issue');await page.getByRole('region',{name:'New template',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();expect(new URL(page.url()).searchParams.has('new')).toBe(false);
 }finally{await app.close()}
});
