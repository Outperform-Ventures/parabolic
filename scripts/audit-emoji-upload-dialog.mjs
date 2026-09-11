import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve('artifacts/verification/settings-parity/batch-362/emojis');await mkdir(out,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XnJ4WQAAAABJRU5ErkJggg==','base64');
const report={capturedAt:new Date().toISOString(),targets:{}};
for(const [name,port,url] of [['parabolic',9224,'https://parabolic.app/parabolic/settings/emojis'],['parabolic',9223,'http://127.0.0.1:49397/settings/emojis']]){
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),page=browser.contexts().flatMap(context=>context.pages()).find(candidate=>candidate.url().includes(name==='parabolic'?'parabolic.app':'127.0.0.1'));if(!page)throw Error(`No ${name} page`);
 await page.setViewportSize({width:1777,height:991});await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(300);
 const input=page.locator('input[type=file]').first();await input.setInputFiles({name:'parity-smile.png',mimeType:'image/png',buffer:png});await page.waitForTimeout(180);
 report.targets[name]=await page.evaluate(()=>{const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'},clean=e=>e?.textContent?.replace(/\s+/g,' ').trim()||'',rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}},title=[...document.querySelectorAll('div,h1,h2,h3')].find(e=>visible(e)&&clean(e)==='Add emoji'),dialog=[...document.querySelectorAll('[role=dialog]')].find(visible)||(()=>{let e=title;while(e){const r=e.getBoundingClientRect();if(Math.abs(r.width-480)<2&&Math.abs(r.height-185)<2)return e;e=e.parentElement}return null})(),sections=dialog?[...dialog.children].filter(visible):[];return{dialog:rect(dialog),sections:sections.map(e=>({text:clean(e),rect:rect(e)})),title:rect(title),text:clean(dialog),buttons:[...(dialog?.querySelectorAll('button')||[])].filter(visible).map(e=>({name:clean(e.getAttribute('aria-label'))||clean(e.textContent),rect:rect(e)})),inputs:[...(dialog?.querySelectorAll('input')||[])].filter(visible).map(e=>({label:e.getAttribute('aria-label')||'',placeholder:e.getAttribute('placeholder')||'',value:e.value,rect:rect(e)})),images:[...(dialog?.querySelectorAll('img')||[])].filter(visible).map(e=>rect(e))}});
 await page.screenshot({path:path.join(out,`${name}.png`)});await page.keyboard.press('Escape');await browser.close();
}
await writeFile(path.join(out,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
