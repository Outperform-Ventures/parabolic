import{test,expect}from'@playwright/test';
import{createApp}from'../../src/server/app';
import{resolve}from'node:path';
test('keyboard range starts at the active row, contracts, and joins adjacent selection corners',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(`${url}/auth/setup`,{data:{name:'Range QA',email:'range@example.test',password:'isolated-range-parity',workspaceName:'Range QA'}});
  const state=await(await page.request.get(`${url}/api/v1/state`)).json();
  for(let i=0;i<4;i++)await page.request.post(`${url}/api/v1/issues`,{data:{teamId:state.teams[0].id,title:`Range ${i}`,priority:2}});
  await page.goto(`${url}/team/${state.teams[0].id}/all`);const rows=page.getByTestId('issue-row');await expect(rows).toHaveCount(4);
  const selected=()=>page.locator('[data-testid="issue-row"][aria-selected="true"]');
  const corners=()=>selected().evaluateAll(es=>es.map(e=>getComputedStyle(e,'::before').borderRadius));
  await rows.first().hover();
  await page.keyboard.press('Shift+ArrowDown');await expect(selected()).toHaveCount(1);await expect(rows.first()).toHaveClass(/focused/);
  await page.keyboard.press('Shift+ArrowDown');await expect(selected()).toHaveCount(2);expect(await corners()).toEqual(['8px 8px 0px 0px','0px 0px 8px 8px']);
  await page.keyboard.press('Shift+ArrowDown');await expect(selected()).toHaveCount(3);expect(await corners()).toEqual(['8px 8px 0px 0px','0px','0px 0px 8px 8px']);
  await page.keyboard.press('Shift+ArrowUp');await expect(selected()).toHaveCount(2);
  await page.keyboard.press('Shift+ArrowUp');await expect(selected()).toHaveCount(1);expect(await corners()).toEqual(['8px']);
  await page.keyboard.press('Escape');await expect(selected()).toHaveCount(0);
  await rows.first().hover();await page.keyboard.press('Meta+a');await expect(selected()).toHaveCount(4);
  await page.keyboard.press('x');await expect(selected()).toHaveCount(3);await expect(rows.first()).toHaveAttribute('data-keyboard-active','false');
  await page.keyboard.press('Shift+x');await expect(selected()).toHaveCount(4);await expect(rows.first()).toHaveAttribute('data-keyboard-active','false');
  await page.keyboard.press('Escape');await expect(selected()).toHaveCount(0);
  await rows.first().hover();await page.keyboard.press('Shift+x');await expect(selected()).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-keyboard-active','false');
  await rows.nth(2).hover();await page.keyboard.press('Shift+x');await expect(selected()).toHaveCount(3);
  await page.keyboard.press('Shift+x');await expect(selected()).toHaveCount(3);
 }finally{await page.close();await app.close();}
});
