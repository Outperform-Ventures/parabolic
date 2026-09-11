import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('workspace security controls persist the retained authentication, management, privacy and compliance policies',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Security owner',email:'security-owner@example.test',password:'security-password-123'}});
    await page.goto(url+'/settings/security');
    await page.getByLabel('New user invitations',{exact:true}).selectOption('members');
    await page.getByLabel('Team creation',{exact:true}).selectOption('admins');
    await page.getByRole('switch',{name:'Restrict file uploads',exact:true}).click();
    await page.getByRole('switch',{name:'Reduce personal information from support integrations',exact:true}).click();
    await page.getByRole('switch',{name:'HIPAA compliance',exact:true}).click();
    await expect.poll(async()=>{const state=await(await page.request.get(url+'/api/v1/state')).json(),workspace=state.workspaces.find((item:any)=>item.id===state.workspaceId);return [workspace.allowMemberInvites,workspace.teamCreationPolicy,workspace.restrictFileUploads,workspace.reduceSupportIntegrationPersonalInformation,workspace.hipaaCompliance]}).toEqual([true,'admins',true,true,true]);
    await page.reload();
    await expect(page.getByLabel('New user invitations',{exact:true})).toHaveValue('members');
    await expect(page.getByRole('switch',{name:'HIPAA compliance',exact:true})).toBeChecked();
  }finally{await page.close();await app.close()}
});
