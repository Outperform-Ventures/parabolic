import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('empty board space pans horizontally and releases cleanly without changing issues',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});
 const {url}=await app.start();
 try{
  await page.setViewportSize({width:1000,height:800});
  await page.request.post(`${url}/auth/setup`,{data:{name:'Board QA',email:'board-pan@example.test',password:'isolated-board-pan',workspaceName:'Board QA'}});
  const initial=await(await page.request.get(`${url}/api/v1/state`)).json();
  const team=initial.teams[0];
  for(let priority=0;priority<5;priority++)await page.request.post(`${url}/api/v1/issues`,{data:{teamId:team.id,title:`Board issue ${priority}`,priority}});
  await page.goto(`${url}/team/${team.id}/all`);
  await page.getByRole('button',{name:'Display options',exact:true}).click();
  await page.getByLabel('Grouping',{exact:true}).selectOption('priority');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+b');
  const board=page.locator('.board-scroll');
  await expect(board).toBeVisible();
  const rect=await board.boundingBox();
  if(!rect)throw new Error('Missing board');
  const x=rect.x+rect.width-80,y=rect.y+rect.height-80;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x-220,y,{steps:8});
  await expect.poll(()=>board.evaluate(el=>el.scrollLeft)).toBeGreaterThan(150);
  await expect(board).toHaveClass(/board-panning/);
  await page.mouse.up();
  await expect(board).not.toHaveClass(/board-panning/);
  const left=await board.evaluate(el=>el.scrollLeft);
  await page.mouse.move(x,y);
  expect(await board.evaluate(el=>el.scrollLeft)).toBe(left);
  await board.evaluate(el=>el.scrollLeft=0);
  const card=board.locator('.board-card').first();
  await card.click();
  await expect(board).not.toHaveClass(/board-panning/);
  expect(await board.evaluate(el=>el.scrollLeft)).toBe(0);
  const final=await(await page.request.get(`${url}/api/v1/state`)).json();
  expect(final.issues.map((issue:any)=>issue.priority).sort()).toEqual([0,1,2,3,4]);
 }finally{await page.close();await app.close();}
});
