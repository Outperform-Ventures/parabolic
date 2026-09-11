import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('empty global search exposes the captured prompt and navigable content scopes',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Search baseline QA',email:'search-baseline-batch041@example.test',password:'search-baseline-password'}});
  await page.goto(url+'/search');
  const input=page.getByRole('combobox',{name:'Search workspace content',exact:true});await expect(input).toBeFocused();await expect(input).toHaveAttribute('placeholder','Search issues, projects, and documents…');
  const empty=page.locator('.search-recents.is-empty');await expect(empty.getByRole('heading',{name:'Search',exact:true})).toBeVisible();await expect(empty).toContainText('Find issues, projects, initiatives, and documents');
  const scopes=page.locator('.search-controls .page-tabs').getByRole('link');await expect(scopes).toHaveText(['All','Issues','Projects','Initiatives','Documents']);
  await expect(scopes.nth(0)).toHaveAttribute('href','/search');await expect(scopes.nth(0)).toHaveAttribute('aria-current','page');
  await scopes.nth(1).click();await expect(page).toHaveURL(url+'/search?type=Issues');await expect(page.getByRole('link',{name:'Issues',exact:true})).toHaveAttribute('aria-current','page');
 }finally{await page.close();await app.close()}
});
