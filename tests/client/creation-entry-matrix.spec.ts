import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('compact, expanded, repeat, multiline-paste and group creation preserve explicit defaults',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(12000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'creation-matrix@example.test',name:'Owner',password:'creation-matrix-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const issues=async()=>{const result=await(await page.request.get(url+'/api/v1/issues')).json();return result.nodes};
  await page.goto(url+'/new?team='+team.id+'&priority=high');await page.getByLabel('Issue title',{exact:true}).fill('Compact repeated');await page.locator('.issue-composer .ProseMirror').fill('First description');await page.keyboard.press('ControlOrMeta+Shift+Enter');
  await expect(page.getByLabel('Issue title',{exact:true})).toHaveValue('');await expect(page.locator('.issue-composer .ProseMirror')).toHaveText('');
  await page.getByRole('button',{name:'Expand composer',exact:true}).click();await expect(page.locator('.issue-composer')).toHaveClass(/expanded/);await page.getByLabel('Issue title',{exact:true}).fill('Expanded second');await page.keyboard.press('ControlOrMeta+Enter');await expect(page.locator('.issue-composer')).toHaveCount(0);
  await expect.poll(async()=>(await issues()).filter((issue:any)=>['Compact repeated','Expanded second'].includes(issue.title)).map((issue:any)=>issue.priority)).toEqual([2,2]);
  await page.getByRole('button',{name:'Create new issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).evaluate(element=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=> 'Pasted first\nPasted second'}});element.dispatchEvent(event)});
  await expect(page.getByLabel('Issue titles',{exact:true})).toHaveValue('Pasted first\nPasted second');await page.getByRole('button',{name:'Create 2 issues',exact:true}).click();await expect(page.locator('.issue-composer')).toHaveCount(0);
  await page.getByRole('button',{name:'Add issue to Backlog',exact:true}).first().click();await page.getByLabel('Issue title',{exact:true}).fill('From group');await page.getByRole('button',{name:'Create issue',exact:true}).click();
  await expect.poll(async()=>{const rows=await issues();return rows.find((issue:any)=>issue.title==='From group')?.statusId}).toBe(state.statuses.find((status:any)=>status.teamId===team.id&&status.type==='backlog').id);
  expect((await issues()).filter((issue:any)=>issue.title.startsWith('Pasted '))).toHaveLength(2);
 }finally{await app.close()}
});
