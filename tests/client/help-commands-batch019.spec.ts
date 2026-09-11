import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('Help command identities open distinct backed, focus-contained, unconfigured-safe flows',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Help command user',email:'private-user@example.test',password:'help-command-password'}});await page.goto(url+'/my-issues');
  const run=async(label:string)=>{const input=page.getByRole('combobox',{name:'Command menu',exact:true});await expect.poll(async()=>{if(await input.count())return 1;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'command-menu'}})));return 0;}).toBe(1);await input.fill(label);const rows=page.getByRole('option').filter({hasText:label});await expect(rows).toHaveCount(1);await rows.click();};
  await run('Contact support');await expect(page.getByRole('dialog',{name:'Contact us'})).toBeVisible();await expect(page.getByLabel('Question',{exact:true})).toBeFocused();await expect(page.getByText('Support is not configured for this deployment.')).toBeVisible();await expect(page.getByRole('button',{name:'Send',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
  await run('Send feedback');await expect(page.getByRole('dialog',{name:'Send feedback'})).toBeVisible();await expect(page.getByLabel('Feedback',{exact:true})).toBeFocused();await page.keyboard.press('Escape');
  let supportPosts=0;page.on('request',request=>{if(request.url().endsWith('/api/v1/support')&&request.method()==='POST')supportPosts++;});
  await run('Report performance problem');await page.getByLabel('Problem description').fill('List scrolling stalls');await page.getByRole('button',{name:'Capture diagnostics'}).click();const report=JSON.parse(await page.getByLabel('Diagnostic report').inputValue());expect(report.format).toBe('parabolic-diagnostics-v1');expect(report.description).toBe('List scrolling stalls');expect(JSON.stringify(report)).not.toContain('private-user@example.test');expect(report).not.toHaveProperty('url');expect(supportPosts).toBe(0);await page.keyboard.press('Escape');
  await run('Open Parabolic Documentation');await expect(page.getByRole('dialog',{name:'Documentation'})).toBeVisible();await expect(page.getByLabel('Search documentation')).toBeVisible();await page.keyboard.press('Escape');
  await run('Open API Documentation');await expect(page.getByRole('dialog',{name:'Parabolic API Documentation'})).toContainText('/graphql');await page.keyboard.press('Escape');
  await run('Parabolic status');await expect(page.getByRole('dialog',{name:'Parabolic status'})).toContainText('Operational');await page.keyboard.press('Escape');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'command-menu'}})));await page.getByRole('combobox',{name:'Command menu'}).fill('Disable hardware acceleration');await expect(page.getByRole('option').filter({hasText:'Disable hardware acceleration'})).toHaveCount(0);
 }finally{await page.close();await app.close();}
});
