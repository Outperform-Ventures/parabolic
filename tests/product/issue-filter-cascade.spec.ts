import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('filter cascades retain parent searches, scope keyboard navigation, and stay inside the window',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Cascade Owner',email:'cascade@example.test',password:'filter-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json());
  await page.goto(url+'/team/'+state.teams[0].id+'/all');
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true});
  const panels=page.locator('.filter-cascade-panel');
  await trigger.click();
  const root=page.getByRole('textbox',{name:'Add filter',exact:true});
  await root.fill('Dates');
  const dates=page.getByRole('menuitem',{name:'Dates',exact:true});
  await dates.hover();await expect(panels).toHaveCount(2);
  await expect(root).toHaveValue('Dates');await expect(dates).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.issue-filter-back')).toHaveCount(0);
  const due=page.getByRole('menuitem',{name:'Due date',exact:true});
  await due.focus();await page.keyboard.press('ArrowRight');await expect(panels).toHaveCount(3);
  const dueInput=page.getByRole('textbox',{name:'Due date',exact:true});await expect(dueInput).toBeFocused();
  await dueInput.fill('Overdue');await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem',{name:'Overdue',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(panels).toHaveCount(2);await expect(due).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(panels).toHaveCount(1);await expect(dates).toBeFocused();await expect(root).toHaveValue('Dates');
  await page.keyboard.press('ArrowRight');await expect(panels).toHaveCount(2);await page.keyboard.press('Escape');await expect(panels).toHaveCount(0);await expect(trigger).toBeFocused();
  for(const width of [610,800,1777]){
   await page.setViewportSize({width,height:600});await trigger.click();await page.getByRole('menuitem',{name:'Customers',exact:true}).click();await page.getByRole('menuitem',{name:'Customer revenue',exact:true}).click();
   await page.getByRole('textbox',{name:'Enter customer revenue',exact:true}).fill('100');await expect(panels).toHaveCount(3);
   const bounds=await panels.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
   for(const r of bounds){expect(r.left).toBeGreaterThanOrEqual(7);expect(r.right).toBeLessThanOrEqual(width-7);expect(r.top).toBeGreaterThanOrEqual(7);expect(r.bottom).toBeLessThanOrEqual(593);}
   if(width>=800){expect(bounds[1].right).toBeLessThanOrEqual(bounds[0].left+3);expect(bounds[2].right).toBeLessThanOrEqual(bounds[1].left+3);}
   await page.screenshot({path:`artifacts/verification/issue-filter-parity/cascade-${width}.png`});
   for(let level=2;level>=0;level--){await page.keyboard.press('Escape');await expect(panels).toHaveCount(level);}
  }
  await trigger.click();await root.fill('no such field zzz');await page.keyboard.press('Enter');await expect(panels).toHaveCount(1);await expect(root).toBeFocused();
  await page.locator('h1').first().click();await expect(panels).toHaveCount(0);
 }finally{await page.close();await app.close()}
});
