import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('retained document options search and restore-version surface remain functional',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Kuyper Reynolds',email:'document-retained-batch041@example.test',password:'document-retained-password'}});
  const created=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Interim Parabolic Operational Usage',content:'<p>Original operational rules.</p>',visibility:'workspace'}})).json();
  await page.request.patch(url+'/api/v1/documents/'+created.id,{data:{content:'<p>Current operational rules.</p>'}});
  await page.goto(url+'/document/'+created.id);

  await page.getByRole('button',{name:'Document options',exact:true}).click();
  const filter=page.getByRole('searchbox',{name:'Filter document actions',exact:true});
  await expect(filter).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Showing all items');
  await filter.fill('history');
  await expect(page.getByRole('menuitem',{name:'Show document history',exact:true})).toBeVisible();
  await expect(page.getByRole('menuitem',{name:/^Duplicate/})).toBeHidden();
  await page.getByRole('menuitem',{name:'Show document history',exact:true}).click();

  const dialog=page.getByRole('dialog',{name:'Restore version for Interim Parabolic Operational Usage',exact:true});
  await expect(dialog.getByRole('button',{name:'Close modal dialog',exact:true})).toBeVisible();
  await expect(dialog.getByRole('checkbox',{name:'Highlight changes',exact:true})).toBeChecked();
  await expect(dialog.getByText(/Go to change/)).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Previous change',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Next change',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'This is the current version, you cannot restore it',exact:true})).toBeDisabled();
  await dialog.locator('.document-history-versions>button').nth(1).click();
  await expect(dialog.getByRole('region',{name:'Document content',exact:true})).toContainText('Original operational rules.');
  await dialog.getByRole('button',{name:'Restore version',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.feature-document-native-shell [contenteditable="true"]')).toContainText('Original operational rules.');
 }finally{await app.close()}
});
