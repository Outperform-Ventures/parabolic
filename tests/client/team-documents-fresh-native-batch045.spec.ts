import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('team documents match the compact retained directory state and reveal row controls on interaction',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Documents owner',email:'documents-batch045@example.test',password:'documents-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],now=Date.now(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin'],now:new Date(now-4*3600000)};
  const document=app.repo.create(actor,'documents',{teamId:team.id,title:'Parity audit scratch',userId:state.user.id,content:''});
  app.repo.update({...actor,now:new Date(now-3*3600000)},'documents',document.id,{content:'<p>Edited</p>'});
  await page.goto(url+'/team/'+team.id+'/documents');

  const table=page.locator('.team-documents-table'),row=table.locator(`[data-document-id="${document.id}"]`),checkbox=row.getByRole('checkbox'),menu=row.getByRole('button',{name:'Open menu',exact:true}),icon=row.locator('td:first-child > svg');
  await expect(row.locator('time')).toHaveText(['4h ago','3h ago']);
  expect(await row.locator('time').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime')))).toEqual([document.createdAt,app.repo.raw('documents',document.id)!.updatedAt]);
  await expect(checkbox).toHaveCSS('opacity','0');
  await expect(menu).toHaveCSS('opacity','0');
  await row.hover();
  await expect(checkbox).toHaveCSS('opacity','1');
  await expect(menu).toHaveCSS('opacity','1');
  await expect(icon).toHaveCSS('opacity','0');

  const dimensions=await page.locator('.team-documents-page').evaluate(root=>{
   const height=(selector:string)=>Math.round(root.querySelector(selector)!.getBoundingClientRect().height);
   return {header:height(':scope > .feature-header'),tabs:height('.team-documents-tabs'),columnHeader:height('.team-documents-table th'),group:height('.team-document-group td'),row:height('tr[role="link"] td')};
  });
  expect(dimensions).toEqual({header:36,tabs:29,columnHeader:30,group:28,row:39});

  await page.getByRole('button',{name:'Add filter',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Showing all items');
  const filterSearch=page.getByRole('searchbox',{name:'Add Filter…',exact:true}),fields=page.getByRole('listbox',{name:'Document filter fields'}).getByRole('option');
  await expect(filterSearch).toBeFocused();
  await expect(fields).toHaveText(['Advanced filter','Creator','Owner','Project','Dates']);
  await filterSearch.fill('own');
  await expect(fields).toHaveText(['Owner']);
  await filterSearch.fill('advanced');
  await fields.click();
  await expect(page.getByRole('textbox',{name:'Filter documents',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});
