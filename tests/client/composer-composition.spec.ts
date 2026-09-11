import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('issue composer retains marked text and stays open on composition cancellation',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Composer QA',email:'composer-composition@example.test',password:'composition-password'}});await page.goto(url+'/my-issues');await page.getByRole('button',{name:'Create new issue',exact:true}).click();const input=page.getByRole('textbox',{name:'Issue title',exact:true});await expect(input).toBeVisible();
 await input.evaluate(node=>{node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,'´');node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'´',isComposing:true}));node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape',keyCode:229,isComposing:true}));node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'´'}));node.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'Escape',keyCode:27}));node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape',keyCode:27}));});
 await expect(input).toBeVisible();await expect(input).toHaveValue('´');await expect(page.locator('.issue-composer[role=dialog]')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Create issue',exact:true})).toBeFocused();await expect(page.getByRole('dialog',{name:'Discard this issue?'})).toHaveCount(0);await page.waitForTimeout(110);await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Discard this issue?'})).toBeVisible();
 }finally{await app.close()}
});
