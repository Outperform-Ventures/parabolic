import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import { createApp } from '../src/server/app.ts';

// Run with node --import tsx. This checks emitted files and real browser font
// selection, independently of the app's CSS family names and font metadata.
const rendererDirectory = resolve(process.env.PARABOLIC_FONT_RENDERER_DIR || 'dist');
const outputDirectory = resolve(process.env.PARABOLIC_FONT_REPORT_DIR || 'artifacts/verification/font-audit/integrated');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const faces = [
  { style: 'normal', name: 'InterVariable.woff2', hash: '693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3' },
  { style: 'italic', name: 'InterVariable-Italic.woff2', hash: 'e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a' },
];
for (const face of faces) {
  const bytes = await readFile(new URL(`../src/client/fonts/${face.name}`, import.meta.url));
  assert.equal(hash(bytes), face.hash);
  face.base64 = bytes.toString('base64');
}
const report = {
  checkedAt: new Date().toISOString(),
  rendererSha256: hash(await readFile(resolve(rendererDirectory, 'index.html'))),
  metric: 'DOM text width after loading the actual app face versus a separately named, byte-verified upstream face in the same browser; this is not an installed Parabolic pixel comparison.',
  browsers: [],
};
const app = createApp({ databasePath: ':memory:', port: 0, staticDir: rendererDirectory });
const { url } = await app.start();
await mkdir(outputDirectory, { recursive: true });
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]) {
    const browser = await engine.launch({ headless: true, ...(name === 'webkit' && process.env.PARABOLIC_WEBKIT_EXECUTABLE ? { executablePath: process.env.PARABOLIC_WEBKIT_EXECUTABLE } : {}) });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const fontRequests = [], errors = [];
      page.on('request', request => { if (request.resourceType() === 'font') fontRequests.push(request.url()); });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => getComputedStyle(document.documentElement).fontFamily.includes('Inter Variable'));
      const result = await page.evaluate(async faces => {
        for (const face of faces) {
          const reference = new FontFace('Audit Reference Inter', Uint8Array.from(atob(face.base64), c => c.charCodeAt(0)).buffer, { style: face.style, weight: '100 900' });
          await reference.load();
          document.fonts.add(reference);
          await document.fonts.load(`${face.style} 500 22px "Inter Variable"`);
        }
        const rows = [];
        const texts = ['Investigate notification delivery', 'Résumé · Αθήνα · Проект'];
        for (const text of texts) for (const size of [12, 13, 16, 22, 28]) for (const style of ['normal', 'italic']) {
          const row = { text, size, style };
          for (const [label, family] of [['actual', 'Inter Variable'], ['reference', 'Audit Reference Inter']]) {
            const element = document.createElement('span');
            element.style.cssText = `position:fixed;display:inline-block;white-space:pre;font-family:"${family}";font-size:${size}px;font-style:${style};font-weight:500;`;
            element.textContent = text;
            document.body.append(element);
            row[label] = element.getBoundingClientRect().width;
            element.remove();
          }
          rows.push(row);
        }
        return {
          rows,
          actualFaces: [...document.fonts].filter(face => face.family.replaceAll('"', '').replaceAll("'", '') === 'Inter Variable').map(face => ({ family: face.family, style: face.style, weight: face.weight, status: face.status, unicodeRange: face.unicodeRange })),
          preload: document.querySelector('link[rel="preload"][as="font"]')?.href,
        };
      }, faces);
      assert.equal(result.actualFaces.length, 2);
      assert.ok(result.actualFaces.every(face => face.status === 'loaded'));
      assert.ok(result.rows.every(row => Math.abs(row.actual - row.reference) <= 0.02), `${name}: app text metrics differ from the reference`);
      const requests = [...new Set(fontRequests)];
      assert.equal(requests.length, 2);
      assert.ok(requests.every(request => new URL(request).origin === url));
      const sw = await (await context.request.get(`${url}/sw.js`)).text();
      const delivered = [];
      for (const request of requests) {
        const response = await context.request.get(request);
        assert.ok(response.ok());
        const bytes = await response.body(), digest = hash(bytes);
        assert.ok(faces.some(face => face.hash === digest));
        const path = new URL(request).pathname;
        assert.ok(sw.includes(path), `${path}: missing from offline shell manifest`);
        delivered.push({ path, bytes: bytes.length, sha256: digest });
      }
      assert.ok(result.preload && delivered.some(file => file.sha256 === faces[0].hash && new URL(result.preload).pathname === file.path));
      const license = await context.request.get(`${url}/licenses/inter.txt`);
      assert.ok(license.ok());
      assert.equal(hash(await license.body()), '262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a');
      assert.deepEqual(errors, []);
      report.browsers.push({ name, version: browser.version(), passed: true, ...result, delivered, checks: ['normal and true italic loaded', '20 same-engine metric comparisons', 'both font responses byte-identical to upstream/reference', 'same-origin requests only', 'normal face preloaded', 'both faces in offline shell manifest', 'license distributed', 'no browser exceptions'] });
      console.log(`${name}: font assets and ${result.rows.length} text metrics passed`);
    } finally { await browser.close(); }
  }
} finally {
  await app.close();
  await writeFile(resolve(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
}
