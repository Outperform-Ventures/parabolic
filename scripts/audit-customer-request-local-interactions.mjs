import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('artifacts/verification/settings-parity/batch-350/customer-requests');
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('127.0.0.1'));
if (!page) throw new Error('No packaged Parabolic page');
await page.setViewportSize({ width: 1777, height: 991 });
page.setDefaultTimeout(5000);
const url = 'http://127.0.0.1:49397/settings/customers';
const result = {};

const reset = async () => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(300);
};
const snapshot = async name => {
  const value = await page.evaluate(() => {
    const visible = element => { const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none' };
    const clean = value => value?.replace(/\s+/g,' ').trim() || '';
    return {
      overlays:[...document.querySelectorAll('[role=menu],[role=listbox],[role=dialog]')].filter(visible).map(element=>({role:element.getAttribute('role'),text:clean(element.textContent),aria:element.getAttribute('aria-label')})),
      buttons:[...document.querySelectorAll('button')].filter(visible).map(element=>clean(element.getAttribute('aria-label'))||clean(element.textContent)),
      inputs:[...document.querySelectorAll('input,[role=option],[role=menuitem]')].filter(visible).map(element=>({role:element.getAttribute('role'),label:clean(element.getAttribute('aria-label')),text:clean(element.textContent),placeholder:element.getAttribute('placeholder')||''})),
    };
  });
  await page.screenshot({ path:path.join(out,`${name}.png`) });
  result[name]=value;
};

for (const [name, accessibleName] of [['default-team','Default team for customer requests'],['revenue-format','Revenue formatting'],['revenue-currency','Revenue currency']]) {
  await reset();
  const trigger=page.getByRole('combobox',{name:accessibleName,exact:true});await trigger.scrollIntoViewIfNeeded();await trigger.click();await page.waitForTimeout(120);await snapshot(name);
}
await reset();let row=page.locator('.customer-status-card .customer-list-row').first();await row.getByRole('button',{name:'Open menu',exact:true}).click();await snapshot('status-menu');
await reset();row=page.locator('.customer-domain-section .customer-list-row').first();await row.getByRole('button',{name:'Open menu',exact:true}).click();await snapshot('domain-menu');
for(const [name,button] of [['add-status','Create new customer status'],['add-tier','Create new customer tier'],['add-domain','Add excluded domains and emails']]){await reset();const trigger=page.getByRole('button',{name:button,exact:true});await trigger.scrollIntoViewIfNeeded();await trigger.click();await page.waitForTimeout(120);await snapshot(name)}

await writeFile(path.join(out,'interactions.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
