import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('workspace identity and fiscal settings persist inline',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Workspace owner',workspaceName:'Original workspace',email:'workspace-settings@example.test',password:'workspace-settings-password'}});
  await page.goto(url+'/settings/workspace');
  const name=page.locator('.workspace-inline-input'),key=page.locator('.workspace-url-input input');
  await name.fill('Parabolic');await name.blur();await key.fill('parabolic');await key.blur();
  await page.getByRole('combobox',{name:'Fiscal year start',exact:true}).selectOption('April');
  await expect(name).toHaveValue('Parabolic');
  const state=await(await page.request.get(url+'/api/v1/state')).json(),workspace=app.repo.raw('workspaces',state.workspaceId)!;
  expect(workspace.name).toBe('Parabolic');expect(workspace.urlKey).toBe('parabolic');expect(workspace.fiscalYearStart).toBe('April');
 }finally{await page.close();await app.close();}
});
