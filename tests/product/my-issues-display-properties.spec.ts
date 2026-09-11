import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('My issues Activity starts with native visible properties and preserves personal changes',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve(process.env.PARABOLIC_TEST_STATIC_DIR??'dist')});
 const {url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Display owner',email:'display@example.test',password:'test-password'}});
  await page.goto(url+'/my-issues?tab=Activity');
  const open=()=>page.getByRole('button',{name:'Display options',exact:true}).click();
  await open();
  const menu=page.locator('.display-options');
  await expect(menu.locator('.property-toggle-list [aria-pressed="true"]')).toHaveText(['ID','Status','Assignee','Priority','Project','Due date','Estimate','Labels','My activity date']);
  await expect(menu.getByRole('button',{name:'Display activityAt',exact:true})).toHaveCount(1);
  await menu.getByRole('button',{name:'Advanced sorting and display',exact:true}).click();
  await expect(menu.getByRole('button',{name:'Display activityAt',exact:true})).toHaveCount(1);
  await menu.getByRole('button',{name:'Close advanced display',exact:true}).click();
  await expect(menu.getByRole('button',{name:'Reset',exact:true})).toHaveCount(0);
  await expect(menu.getByRole('button',{name:'Set as default',exact:true})).toHaveCount(0);
  await expect(menu.getByRole('checkbox',{name:'Show empty groups',exact:true})).toHaveCount(0);
  await menu.getByRole('button',{name:'Display dueDate',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await open();
  await expect(menu.getByRole('button',{name:'Display dueDate',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Escape');
  await page.goto(url+'/my-issues?tab=Assigned');
  await open();
  await expect(menu.getByRole('checkbox',{name:'Show empty groups',exact:true})).toHaveCount(0);
  await expect(menu.getByRole('tab',{name:'Board',exact:true})).toBeDisabled();
  await menu.getByRole('tab',{name:'List',exact:true}).focus();
  await page.keyboard.press('End');
  await expect(menu.getByRole('tab',{name:'List',exact:true})).toBeFocused();
  await expect(menu.getByRole('tab',{name:'List',exact:true})).toHaveAttribute('aria-selected','true');
  await menu.getByRole('combobox',{name:'Grouping',exact:true}).selectOption('statusId');
  await menu.getByRole('tab',{name:'Board',exact:true}).click();
  await expect(menu.getByRole('tab',{name:'Board',exact:true})).toHaveAttribute('aria-selected','true');
  await menu.getByRole('combobox',{name:'Grouping',exact:true}).selectOption('focus');
  await expect(menu.getByRole('tab',{name:'List',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(menu.getByRole('tab',{name:'Board',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.reload();
  await open();
  await expect(menu.getByRole('tab',{name:'List',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(menu.getByRole('tab',{name:'Board',exact:true})).toBeDisabled();
 }finally{await page.close();await app.close();}
});
