import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('artifacts/verification/settings-parity/batch-300/project-templates');
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('parabolic.app'));
if (!page) throw new Error('No Parabolic page');
await page.setViewportSize({ width: 1777, height: 991 });
const states = {};
const clean = value => value?.replace(/\s+/g, ' ').trim() || '';
for (const buttonName of ['Change project status','Change project priority','Set project lead','Change project members','Change project teams','Change labels','Add dependencies','Add issue','Milestones','Add']) {
  await page.goto('https://parabolic.app/parabolic/settings/templates/project/new');
  await page.waitForTimeout(700);
  const button = page.getByRole('button', { name: buttonName, exact: true }).first();
  if (!await button.count()) { states[buttonName] = { missing: true }; continue; }
  await button.click();
  await page.waitForTimeout(250);
  states[buttonName] = await page.evaluate(() => {
    const visible = element => { const r=element.getBoundingClientRect(),s=getComputedStyle(element); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'; };
    const clean = value => value?.replace(/\s+/g, ' ').trim() || '';
    const overlays=[...document.querySelectorAll('[role=dialog],[role=menu],[role=listbox],[data-radix-popper-content-wrapper]')].filter(visible);
    const root=overlays.at(-1)||document.querySelector('main')||document.body;
    const rect=root.getBoundingClientRect();
    return {url:location.href,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},text:clean(root.textContent),buttons:[...root.querySelectorAll('button')].filter(visible).map(x=>clean(x.getAttribute('aria-label'))||clean(x.textContent)),inputs:[...root.querySelectorAll('input,select,textarea,[contenteditable=true]')].filter(visible).map(x=>({label:clean(x.getAttribute('aria-label')),placeholder:clean(x.getAttribute('placeholder')),value:x.value||''}))};
  });
  await page.screenshot({path:path.join(output,buttonName.toLowerCase().replaceAll(' ','-')+'.png')});
  await page.keyboard.press('Escape').catch(()=>{});
}
await writeFile(path.join(output,'interactions.json'),JSON.stringify(states,null,2));
console.log(JSON.stringify(states,null,2));
await browser.close();
