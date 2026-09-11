import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('integration catalog scaffolding is searchable, routed, and never connects',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Diagnostics owner',email:'diagnostics-private@example.test',password:'diagnostics-password'}});
  await page.goto(url+'/settings/integrations');
  await expect(page.getByRole('heading',{name:'Security & Compliance',exact:true})).toBeAttached();
  await expect(page.getByRole('heading',{name:'Agents',exact:true})).toHaveCount(0);
  const search=page.getByPlaceholder('Search integrations',{exact:true});
  await search.fill('GitHub');
  await expect(page.locator('.feature-provider-card').filter({hasText:/^GitHub/}).first()).toBeVisible();
  await expect(page.locator('.feature-provider-card').filter({hasText:/^Slack/})).toHaveCount(0);
  await search.fill('');
  await page.locator('.feature-provider-card').filter({hasText:/^Slack/}).first().click();
  await expect(page).toHaveURL(/\/settings\/integrations\/slack$/);
  await expect(page.getByRole('heading',{name:'Slack',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enable',exact:true})).toBeDisabled();
  await expect(page.getByText('No organizations connected',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Integrations',exact:true}).click();
  await expect(page).toHaveURL(/\/settings\/integrations$/);
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  expect(state.integrations).toEqual([]);
 }finally{await page.close();await app.close();}
});
