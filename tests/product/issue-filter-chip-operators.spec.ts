import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('categorical chips edit operators directly and preserve negative selections',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try {
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'chip-owner@example.test',password:'filter-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
  for(const [title,priority] of [['High issue',2],['Urgent issue',1],['Low issue',4]])await page.request.post(url+'/api/v1/issues',{data:{title,priority,teamId:team.id}});
  await page.goto(url+'/team/'+team.id+'/all');
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill('Priority High');await page.getByRole('menuitem',{name:'Priority High',exact:true}).click();await page.keyboard.press('Escape');
  const chip=page.locator('.issue-filter-chip'),rows=page.locator('[data-testid=issue-row]');
  await expect(chip.getByRole('button',{name:'Priority',exact:true})).toHaveCount(0);await chip.locator('.filter-chip-field').click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Priority operator',exact:true}).click();await page.getByRole('textbox',{name:'Priority operator search',exact:true}).fill('not');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(chip).toContainText('is not');await expect(rows).toHaveCount(2);await expect(rows).not.toContainText(['High issue','High issue']);
  await chip.getByRole('button',{name:'High',exact:true}).click();await expect(page.locator('.issue-filter-options').last().getByRole('menuitem').first()).toHaveAccessibleName('High');await expect(page.getByRole('menuitem',{name:'High',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('menuitem',{name:'Urgent',exact:true}).click();await page.keyboard.press('Escape');
  await expect(chip).toContainText('is not');await expect(rows).toHaveCount(1);await expect(rows).toContainText('Low issue');await page.reload();await expect(rows).toHaveCount(1);
  await page.getByRole('button',{name:'Priority operator',exact:true}).click();await page.getByRole('menuitem',{name:'is any of',exact:true}).click();await expect(rows).toHaveCount(2);await expect(chip).toContainText('is any of');
  await chip.getByRole('button',{name:'High, Urgent',exact:true}).click();await page.getByRole('menuitem',{name:'Urgent',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Priority operator',exact:true})).toHaveText('is');await expect(rows).toHaveCount(1);await expect(rows).toContainText('High issue');
 }finally{await page.close();await app.close()}
});
