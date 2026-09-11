import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('composer exposes estimate and attachment controls without submitting the empty draft',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Composer parity',email:'composer-parity@example.test',password:'composer-parity-password'}});
  await page.goto(url+'/my-issues');
  await page.getByRole('link',{name:'My issues',exact:true}).waitFor();
  await page.keyboard.press('c');
  const composer=page.locator('.issue-composer');
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Issue title',{exact:true})).toBeFocused();
  await composer.getByRole('textbox',{name:'Add description…',exact:true}).waitFor();
  await page.keyboard.press('Tab');
  await expect(composer.getByRole('textbox',{name:'Add description…',exact:true})).toBeFocused();
  await expect(composer.getByRole('button',{name:'Attach files',exact:true})).toBeVisible();
  await expect(composer.locator('.composer-properties').getByRole('button',{name:/estimate/i})).toBeVisible();
  expect(await composer.evaluate(element=>getComputedStyle(element).borderRadius)).toBe('21px');
  for(const [field,label] of [['priority','Priority'],['projectId','Project'],['estimate','Estimate']])await expect(composer.locator('[data-property="'+field+'"]').locator('span').last()).toHaveText(label);
  const chip=composer.locator('.composer-properties [data-property="priority"]');
  expect(await chip.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('lch(17.574 1.589 272)');
  await expect(composer.getByRole('button',{name:'Attach files'}).locator('svg path')).toHaveAttribute('d',/^M12\.6429/);
  const create=composer.getByRole('button',{name:'Create issue',exact:true});
  await expect(create).toBeEnabled();
  await create.click();
  await expect(composer).toBeVisible();
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  expect(state.issues).toHaveLength(0);
  expect(await composer.getByRole('button',{name:'Attach files'}).locator('svg').evaluate(e=>e.getBoundingClientRect().width)).toBe(16);
  await expect(composer.locator('.composer-top [data-property="teamId"]')).toHaveText(state.teams[0].key);
  await composer.getByRole('button',{name:'Close composer',exact:true}).click();
  await expect(composer).toHaveCount(0);
 }finally{await page.close();await app.close()}
});

test('right-click issue properties remain available and keyboard filtering keeps its input focused',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Menu parity',email:'context-parity@example.test',password:'context-parity-password'}});
  const data=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:data.teams[0].id,title:'Context parity'}})).json();
  await page.goto(url+'/issues/all');
  await page.getByText(issue.identifier,{exact:true}).click({button:'right'});
  const root=page.locator('.issue-action-filter').first(),filter=root.getByRole('searchbox');
  for(const label of ['Status','Priority','Assignee','Labels','Project','Estimate']){
   await expect(root.locator(':scope > [role=menuitem]').filter({hasText:new RegExp('^'+label)})).toBeVisible();
  }
  const primary=root.locator(':scope > .issue-primary-action');
  expect(await primary.evaluateAll(elements=>elements.map(element=>element.getAttribute('aria-label')))).toEqual(['Status','Priority','Assignee','Labels','Project','Estimate']);
  for(const row of await primary.all()){expect((await row.boundingBox())!.height).toBe(32);await expect(row.locator('kbd')).toBeVisible();}
  const labels=await root.locator(':scope > [role=menuitem]').evaluateAll(elements=>elements.filter(element=>!(element instanceof HTMLElement) || !element.hidden).slice(0,8).map(element=>element.getAttribute('aria-label')||element.querySelector('span')?.textContent));
  expect(labels).toEqual(['Status','Priority','Assignee','Due date','Labels','Project','Estimate','More properties']);
  const visibleRows=root.locator(':scope > [role=menuitem]:visible');
  const rowLabels=await visibleRows.evaluateAll(elements=>elements.map(element=>element.getAttribute('aria-label')||element.querySelector('span')?.textContent));
  expect(rowLabels).toEqual([
   'Status','Priority','Assignee','Due date','Labels','Project','Estimate','More properties',
   'Create related','Mark as','Copy','Convert to','Make a copy…','Move','Open in','Favorite','Remind me','Delete',
  ]);
  for(const label of ['Set SLA','Apply template','Copy pre-filled create issue URL','Subscribe','Unsubscribe','Show description history'])
   expect(rowLabels).not.toContain(label);
  const menu=root.locator('..');
  expect(await menu.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}))).toEqual({width:181,height:638});
  expect(await root.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}))).toEqual({width:179,height:624});
  expect(await root.locator(':scope > .menu-separator').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height))).toEqual([12,12,12,12]);
  expect(rowLabels.indexOf('Move')).toBe(rowLabels.indexOf('Make a copy…')+1);
  expect(rowLabels.indexOf('Open in')).toBe(rowLabels.indexOf('Move')+1);
  expect((await primary.first().boundingBox())!.width).toBe(179);
  await expect(root.getByRole('menuitem',{name:/^Delete/})).not.toHaveClass(/danger/);
  await expect(primary.first().locator('.issue-menu-arrow')).toHaveText('▶');
  await filter.fill('Due date');
  await filter.press('ArrowDown');
  await expect(filter).toBeFocused();
  await expect(root.getByRole('menuitem',{name:/^Due date/})).toHaveAttribute('data-action-active','true');
  await filter.press('Enter');
  await expect(page.getByRole('menu',{name:'Due date',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
 }finally{await page.close();await app.close()}
});
