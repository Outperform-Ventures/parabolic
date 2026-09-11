import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('issue layout tabs support keyboard selection',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{await page.request.post(url+'/auth/setup',{data:{name:'Layout owner',email:'layout-tabs@example.test',password:'test-password'}});await page.goto(url+'/my-issues');await page.getByRole('button',{name:'Display options',exact:true}).click();
 const tabs=page.getByRole('tablist',{name:'Issue layout'}),list=tabs.getByRole('tab',{name:'List',exact:true}),board=tabs.getByRole('tab',{name:'Board',exact:true});
 await expect(list).toHaveAttribute('aria-selected','true');await list.focus();await page.keyboard.press('ArrowRight');await expect(board).toHaveAttribute('aria-selected','true');await expect(board).toBeFocused();await page.keyboard.press('Home');await expect(list).toHaveAttribute('aria-selected','true');await expect(list).toBeFocused();
 }finally{await page.close();await app.close()}
});
