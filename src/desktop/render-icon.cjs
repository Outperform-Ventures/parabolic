const { app, BrowserWindow } = require('electron');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const output = resolve(process.argv[2] || 'src/desktop/Parabolic.iconset');
app.whenReady().then(async () => {
  app.dock?.hide();
  const window = new BrowserWindow({ width: 1024, height: 1024, show: false, frame: false, transparent: true, webPreferences: { offscreen: true, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const svg = readFileSync(join(__dirname, 'icon.svg'), 'utf8');
  await window.loadURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const bitmap = await window.webContents.capturePage();
  if (bitmap.isEmpty()) throw new Error('Icon render was empty');
  mkdirSync(output, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    writeFileSync(join(output, `icon_${size}x${size}.png`), bitmap.resize({ width: size, height: size, quality: 'best' }).toPNG());
    writeFileSync(join(output, `icon_${size}x${size}@2x.png`), bitmap.resize({ width: size * 2, height: size * 2, quality: 'best' }).toPNG());
  }
  window.destroy(); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
