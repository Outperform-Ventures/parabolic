import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { UpdateCheckResult } from 'electron-updater';
import { MacUpdateTransport } from '../../src/desktop/update-transport';

class Updater extends EventEmitter {
  autoDownload = true; autoInstallOnAppQuit = true; autoRunAppAfterInstall = false; allowDowngrade = true;
  quits = 0; downloads = 0; failDownload = false;
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const info = { version: '0.2.0', files: [], releaseDate: '2026-09-06T00:00:00.000Z', path: 'update.zip', sha512: 'fixture' };
    return { isUpdateAvailable: true, updateInfo: info, versionInfo: info };
  }
  async downloadUpdate() {
    this.downloads++; this.emit('download-progress', { percent: 50 });
    if (this.failDownload) throw Error('Invalid checksum');
    return ['/verified-update.zip'];
  }
  quitAndInstall() { this.quits++; }
}
class NativeUpdater extends EventEmitter {
  checks = 0;
  checkForUpdates() { this.checks++; }
}
function fixture(timeout?: number) {
  const updater = new Updater(), native = new NativeUpdater(), errors: unknown[] = [];
  // Electron's MacUpdater always listens to native errors and forwards them.
  native.on('error', error => updater.emit('error', error));
  const transport = new MacUpdateTransport(updater, native, error => errors.push(error), timeout);
  return { updater, native, errors, transport };
}

test('Mac updater transport disables implicit installation and verifies before committing a restart', async () => {
  const f = fixture();
  assert.equal(f.updater.autoDownload, false); assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.autoRunAppAfterInstall, true); assert.equal(f.updater.allowDowngrade, false);
  assert.deepEqual(await f.transport.check(), { available: true, version: '0.2.0' });
  await assert.rejects(f.transport.stage(), /Download an update/);
  assert.throws(() => f.transport.quitAndInstall(), /not verified/);
  const progress: number[] = []; await f.transport.download(percent => progress.push(percent));
  assert.deepEqual(progress, [50]); assert.equal(f.updater.listenerCount('download-progress'), 0);
  assert.equal(f.native.checks, 0); assert.equal(f.updater.quits, 0);
  const staging = f.transport.stage(); assert.equal(staging, f.transport.stage()); await Promise.resolve();
  assert.equal(f.native.checks, 1); assert.equal(f.updater.quits, 0);
  assert.throws(() => f.transport.quitAndInstall(), /not verified/);
  f.native.emit('update-downloaded'); await staging;
  assert.equal(f.updater.quits, 0); assert.equal(f.native.listenerCount('update-downloaded'), 0);
  await f.transport.stage(); assert.equal(f.native.checks, 1);
  f.transport.quitAndInstall(); assert.equal(f.updater.quits, 1);
  f.transport.dispose();
});

test('Mac updater transport rejects native signature failures without quitting or leaking listeners', async () => {
  const f = fixture(); await f.transport.download(() => {});
  const staging = f.transport.stage(); await Promise.resolve(); f.native.emit('error', Error('Signature rejected'));
  await assert.rejects(staging, /Signature rejected/);
  assert.equal(f.errors.length, 1); assert.equal(f.native.listenerCount('update-downloaded'), 0);
  assert.equal(f.native.listenerCount('error'), 1); assert.equal(f.updater.quits, 0);
  assert.throws(() => f.transport.quitAndInstall(), /not verified/);
  const retry = f.transport.stage(); await Promise.resolve(); f.native.emit('update-downloaded'); await retry;
  f.transport.quitAndInstall(); assert.equal(f.updater.quits, 1); f.transport.dispose();
});

test('Mac updater transport requires fresh native verification for every replacement archive', async () => {
  const f = fixture(); await f.transport.download(() => {});
  const stage = f.transport.stage(); await Promise.resolve(); f.native.emit('update-downloaded'); await stage;
  await f.transport.download(() => {}); assert.throws(() => f.transport.quitAndInstall(), /not verified/);
  const second = f.transport.stage(); await Promise.resolve();
  await assert.rejects(f.transport.download(() => {}), /already being prepared/);
  f.native.emit('update-downloaded'); await second; f.transport.quitAndInstall();
  assert.equal(f.native.checks, 2); assert.equal(f.updater.quits, 1); f.transport.dispose();
});

test('Mac updater transport rejects failed archives and waits for a timed-out native preparation before replacing it', async () => {
  const f = fixture(10); f.updater.failDownload = true;
  await assert.rejects(f.transport.download(() => {}), /Invalid checksum/);
  assert.equal(f.updater.listenerCount('download-progress'), 0); await assert.rejects(f.transport.stage(), /Download an update/);
  f.updater.failDownload = false; await f.transport.download(() => {});
  await assert.rejects(f.transport.stage(), /timed out/); assert.equal(f.native.listenerCount('update-downloaded'), 1);
  assert.equal(f.updater.quits, 0);
  await assert.rejects(f.transport.stage(), /still preparing/);
  await assert.rejects(f.transport.download(() => {}), /already being prepared/);
  f.native.emit('update-downloaded'); await f.transport.stage();
  assert.equal(f.native.checks, 1); assert.equal(f.native.listenerCount('update-downloaded'), 0);
  assert.equal(f.updater.quits, 0); f.transport.dispose();
});

test('Mac updater disposal cancels staging and never interprets late native completion as permission to quit', async () => {
  const f = fixture(); await f.transport.download(() => {});
  const stage = f.transport.stage(); await Promise.resolve(); f.transport.dispose();
  await assert.rejects(stage, /stopped/); f.native.emit('update-downloaded');
  assert.equal(f.updater.quits, 0); assert.equal(f.native.listenerCount('update-downloaded'), 0);
  await assert.rejects(f.transport.check(), /stopped/); assert.throws(() => f.transport.quitAndInstall(), /stopped/);
});
