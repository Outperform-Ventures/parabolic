import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('issue rows distinguish pointer and keyboard activation without leaving a stale hover highlight',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
 try{
  await page.setViewportSize({width:1777,height:991});
  await page.request.post(`${url}/auth/setup`,{data:{name:'Row QA',email:'row-mode@example.test',password:'isolated-row-input-mode',workspaceName:'Row QA'}});
  const state=await(await page.request.get(`${url}/api/v1/state`)).json();
  for(let i=0;i<3;i++)await page.request.post(`${url}/api/v1/issues`,{data:{teamId:state.teams[0].id,title:`Input mode issue ${i}`,priority:2}});
  await page.goto(`${url}/team/${state.teams[0].id}/all`);
  const rows=page.getByTestId('issue-row');await expect(rows).toHaveCount(3);
  const first=rows.nth(0),second=rows.nth(1);
  const layer=(row:any)=>row.evaluate((e:HTMLElement)=>{const s=getComputedStyle(e,'::before');return{background:s.backgroundColor,inset:s.inset,shadow:s.boxShadow};});
  await first.hover();
  expect(await layer(first)).toEqual({background:'lch(9.345 0.85 272)',inset:'0px 8px',shadow:'none'});
  await page.keyboard.press('ArrowDown');
  await expect(second).toHaveAttribute('data-keyboard-active','true');
  expect(await layer(second)).toEqual({background:'lch(9.345 0.85 272)',inset:'0px 8px',shadow:'lch(19.701 19.952 286.445) 0px 0px 0px 1px inset'});
  await expect(second.locator('.row-checkbox')).toHaveCSS('opacity','1');
  await expect(first).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(first.locator('.row-checkbox')).toHaveCSS('opacity','0');
  await page.keyboard.press('x');await expect(second).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('x');await expect(second).toHaveAttribute('aria-selected','false');
  const rect=await first.boundingBox();if(!rect)throw Error('Missing row');
  // Pointer stays in the first row throughout keyboard navigation; movement must reactivate it without mouseenter.
  await page.mouse.move(rect.x+120,rect.y+20);
  await expect(first).toHaveClass(/focused/);await expect(first).toHaveAttribute('data-keyboard-active','false');
  await expect(second).not.toHaveClass(/focused/);
  expect((await layer(first)).shadow).toBe('none');
 }finally{await page.close();await app.close();}
});
