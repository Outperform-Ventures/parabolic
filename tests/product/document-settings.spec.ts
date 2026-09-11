import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('document settings create, edit, list and delete document templates',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Document owner',email:'document-settings@example.test',password:'document-settings-password'}});
    await page.goto(url+'/settings/documents');
    await expect(page.getByText('No document templates',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Create new document template',exact:true}).click();
    const create=page.getByRole('dialog',{name:'New template',exact:true});
    await expect(create.getByLabel('Template type',{exact:true})).toHaveValue('document');
    await create.getByLabel('Template name',{exact:true}).fill('Weekly brief');
    await create.getByLabel('Template default title',{exact:true}).fill('Weekly update');
    await create.getByRole('button',{name:'Create template',exact:true}).click();
    await expect(page).toHaveURL(url+'/settings/documents');
    const row=page.locator('.document-template-row').filter({hasText:'Weekly brief'});
    await expect(row).toContainText('Workspace');
    await row.getByRole('link',{name:'Edit',exact:true}).click();
    const edit=page.getByRole('dialog',{name:'Edit template',exact:true});
    await edit.getByLabel('Template name',{exact:true}).fill('Weekly launch brief');
    await edit.getByRole('button',{name:'Save template',exact:true}).click();
    await expect(page).toHaveURL(url+'/settings/documents');
    const updated=page.locator('.document-template-row').filter({hasText:'Weekly launch brief'});
    await updated.getByRole('button',{name:'More actions',exact:true}).click();
    await page.getByRole('button',{name:'Delete',exact:true}).click();
    const confirm=page.getByRole('dialog');
    await confirm.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(page.getByText('No document templates',{exact:true})).toBeVisible();
  }finally{await page.close();await app.close()}
});
