import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('profile blocks last owner, confirms leaving, and administrators restore workspace access',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();const admin=await browser.newContext();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Original Owner',email:'owner@example.test',password:'owner-password-123'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();await page.goto(url+'/settings/profile');await expect(page.getByRole('button',{name:'Leave workspace',exact:true})).toBeDisabled();
  const invite=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'second@example.test',role:'admin'}})).json();
  const token=invite.token||new URL(invite.url||invite.inviteUrl,url).searchParams.get('token');
  const joined=await admin.request.post(url+'/auth/join',{data:{token,name:'Second Admin',password:'second-password-123'}});expect(joined.status()).toBe(201);
  await page.reload();await page.getByRole('button',{name:'Leave workspace',exact:true}).click();const dialog=page.getByRole('dialog',{name:/Leave .*\?/});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect((await page.request.get(url+'/api/v1/state')).status()).toBe(200);
  await page.getByRole('button',{name:'Leave workspace',exact:true}).click();await page.getByRole('dialog',{name:/Leave .*\?/}).getByRole('button',{name:'Leave workspace',exact:true}).click();await expect.poll(async()=>(await page.request.get(url+'/api/v1/state')).status()).toBe(401);
  const adminPage=await admin.newPage();await adminPage.goto(url+'/settings/members');await adminPage.getByRole('combobox',{name:'Member status',exact:true}).click();await adminPage.getByRole('option',{name:'Left workspace',exact:true}).click();const departedRow=adminPage.locator('.members-table-row').filter({hasText:'owner@example.test'});await departedRow.getByRole('button',{name:'Original Owner actions',exact:true}).click();await adminPage.getByRole('button',{name:'Restore access',exact:true}).click();await adminPage.getByRole('dialog',{name:/Restore .* access\?/}).getByRole('button',{name:'Confirm',exact:true}).click();await expect(departedRow).toHaveCount(0);
  expect((await page.request.post(url+'/auth/login',{data:{email:'owner@example.test',password:'owner-password-123'}})).status()).toBe(200);await page.goto(url+'/settings/profile');await expect(page.getByRole('heading',{name:'Profile',exact:true})).toBeVisible();
 }finally{await page.close();await admin.close();await app.close();}
});
