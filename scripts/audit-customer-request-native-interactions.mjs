import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('artifacts/verification/settings-parity/batch-346/customer-requests');
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('parabolic.app'));
if (!page) throw new Error('No native Parabolic page');
await page.setViewportSize({ width: 1777, height: 991 });
if (!page.url().includes('/settings/customer-requests')) {
  await page.goto('https://parabolic.app/parabolic/settings/customer-requests', { waitUntil: 'domcontentloaded', timeout: 10000 });
}
await page.waitForTimeout(500);
page.setDefaultTimeout(5000);

const snapshot = async name => {
  const value = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const clean = value => value?.replace(/\s+/g, ' ').trim() || '';
    const nodes = [...document.querySelectorAll('[role=menu],[role=listbox],[role=dialog],[data-radix-popper-content-wrapper]')].filter(visible);
    return {
      overlays: nodes.map(element => ({ role: element.getAttribute('role'), text: clean(element.textContent), aria: element.getAttribute('aria-label') })),
      buttons: [...document.querySelectorAll('button')].filter(visible).map(element => clean(element.getAttribute('aria-label')) || clean(element.textContent)),
      inputs: [...document.querySelectorAll('input,[role=option],[role=menuitem]')].filter(visible).map(element => ({role: element.getAttribute('role'), label: clean(element.getAttribute('aria-label')), text: clean(element.textContent), placeholder: element.getAttribute('placeholder') || ''})),
    };
  });
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  return value;
};

const result = {};
for (const [name, locator] of [
  ['default-team', page.getByRole('combobox', { name: /Default team for customer requests/i })],
  ['revenue-format', page.getByRole('combobox', { name: /Revenue formatting/i })],
  ['revenue-currency', page.getByRole('combobox', { name: /Revenue currency/i })],
]) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ force: true });
  await page.waitForTimeout(180);
  result[name] = await snapshot(name);
  await page.keyboard.press('Escape');
}

const menus = page.getByRole('button', { name: 'Open menu', exact: true });
const menuCount = await menus.count();
result.openMenuCount = menuCount;
for (let index = 0; index < menuCount; index++) {
  await menus.nth(index).scrollIntoViewIfNeeded();
  await menus.nth(index).click({ force: true });
  await page.waitForTimeout(180);
  result[`open-menu-${index}`] = await snapshot(`open-menu-${index}`);
  await page.keyboard.press('Escape');
}

for (const [name, locator] of [
  ['add-status', page.getByRole('button', { name: 'Create new customer status', exact: true })],
  ['add-tier', page.getByRole('button', { name: 'Create new customer tier', exact: true })],
]) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ force: true });
  await page.waitForTimeout(180);
  result[name] = await snapshot(name);
  await page.keyboard.press('Escape');
}

await writeFile(path.join(out, 'interactions.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
