import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [id, nativePath, localPath, batch = 'batch-270'] = process.argv.slice(2);
if (!id || !nativePath || !localPath) throw new Error('Usage: node scripts/audit-settings-page.mjs id nativePath localPath [batch]');
const output = path.resolve('artifacts/verification/settings-parity', batch, id);
await mkdir(output, { recursive: true });
const targets = [
  { name: 'parabolic', port: 9224, url: `https://parabolic.app/parabolic/settings/${nativePath}` },
  { name: 'parabolic', port: 9223, url: `http://127.0.0.1:49397/settings/${localPath}` },
];
const report = { id, capturedAt: new Date().toISOString(), targets: {} };
for (const target of targets) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${target.port}`);
  const page = browser.contexts().flatMap(context => context.pages()).find(candidate =>
    candidate.url().includes(target.name === 'parabolic' ? 'parabolic.app' : '127.0.0.1'),
  );
  if (!page) throw new Error(`No ${target.name} page`);
  await page.setViewportSize({ width: 1777, height: 991 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(target.url);
  await page.waitForTimeout(target.name === 'parabolic' ? 900 : 500);
  const snapshot = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const clean = value => value?.replace(/\s+/g, ' ').trim() || '';
    const scrollables = [...document.querySelectorAll('*')].filter(element => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 20;
    });
    const scroll = scrollables.sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
    const main = document.querySelector('main') || document.body;
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      scroll: scroll && { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, className: scroll.className },
      headings: [...main.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(element => clean(element.textContent)),
      buttons: [...main.querySelectorAll('button')].filter(visible).map(element => clean(element.getAttribute('aria-label')) || clean(element.textContent)),
      inputs: [...main.querySelectorAll('input,select,textarea,[contenteditable=true]')].filter(visible).map(element => ({ label: clean(element.getAttribute('aria-label')), placeholder: clean(element.getAttribute('placeholder')), value: element.value || '' })),
      text: clean(main.textContent),
    };
  });
  snapshot.pageErrors = errors;
  report.targets[target.name] = snapshot;
  for (const [position, ratio] of [['top', 0], ['middle', 0.5], ['bottom', 1]]) {
    await page.evaluate(value => {
      const candidates = [...document.querySelectorAll('*')].filter(element => {
        const style = getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 20;
      });
      const scroll = candidates.sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
      if (scroll) scroll.scrollTop = (scroll.scrollHeight - scroll.clientHeight) * value;
    }, ratio);
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(output, `${position}-${target.name}.png`) });
  }
  await browser.close();
}
await writeFile(path.join(output, 'audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
