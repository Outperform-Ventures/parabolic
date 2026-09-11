import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('holding an issue over a bottom row scrolls the collection and dragend stops it',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
 await page.request.post(url+'/auth/setup',{data:{name:'Drag owner',email:'drag-edge@example.test',password:'drag-edge-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();const actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};const team=state.teams[0],status=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='unstarted');
 for(let i=0;i<65;i++)app.repo.create(actor,'issues',{title:`Edge issue ${i}`,teamId:team.id,statusId:status.id,assigneeId:state.user.id,priority:2});
 await page.goto(url+'/my-issues');await expect(page.getByTestId('issue-row').first()).toBeVisible();
 const transfer=await page.evaluateHandle(()=>new DataTransfer());await page.getByTestId('issue-row').first().dispatchEvent('dragstart',{dataTransfer:transfer});
 const target=await page.evaluate(()=>{const row=document.querySelector('[data-testid="issue-row"]')!;let scroller=row.parentElement!;while(scroller&&!(scroller.scrollHeight>scroller.clientHeight&&['auto','scroll'].includes(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement!;const rect=scroller.getBoundingClientRect();scroller.setAttribute('data-edge-test','true');const rows=[...scroller.querySelectorAll('[data-testid="issue-row"]')];const last=rows.filter(e=>{const r=e.getBoundingClientRect();return r.top<rect.bottom-3&&r.bottom>rect.bottom-45}).at(-1)!;return{id:last.getAttribute('data-issue-id'),x:rect.left+200,y:Math.min(last.getBoundingClientRect().bottom-2,rect.bottom-3)}});
 await page.locator(`[data-issue-id="${target.id}"]`).dispatchEvent('dragover',{dataTransfer:transfer,clientX:target.x,clientY:target.y});
 await expect.poll(()=>page.locator('[data-edge-test]').evaluate(e=>e.scrollTop),{timeout:1200}).toBeGreaterThan(30);
 await page.locator('[data-edge-test]').evaluate(e=>{e.scrollTop=0});
 const outside=await page.locator('[data-edge-test]').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.left+200,y:r.bottom+10}});
 await page.getByTestId('issue-row').first().dispatchEvent('drag',{dataTransfer:transfer,clientX:outside.x,clientY:outside.y});
 await expect.poll(()=>page.locator('[data-edge-test]').evaluate(e=>e.scrollTop),{timeout:1200}).toBeGreaterThan(30);
 await page.keyboard.press('Escape');const escaped=await page.locator('[data-edge-test]').evaluate(e=>e.scrollTop);await page.waitForTimeout(150);expect(await page.locator('[data-edge-test]').evaluate(e=>e.scrollTop)).toBe(escaped);
 await page.getByTestId('issue-row').first().dispatchEvent('dragend',{dataTransfer:transfer});const stopped=await page.locator('[data-edge-test]').evaluate(e=>e.scrollTop);await page.waitForTimeout(150);expect(await page.locator('[data-edge-test]').evaluate(e=>e.scrollTop)).toBe(stopped);await transfer.dispose();
 }finally{await page.close();await app.close();}
});
