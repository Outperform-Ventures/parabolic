import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateController, UPDATE_CHECK_INTERVAL, updateMenu, type UpdateState, type UpdateTransport } from '../../src/desktop/update-controller';

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fixture(overrides: Partial<UpdateTransport> = {}, disabledReason?: string) {
  const calls: string[] = [], states: UpdateState[] = [], notices: [string, string | undefined][] = [], errors: unknown[] = [];
  let next = { available: true, version: '0.2.0' }, tick = () => {}, interval = 0;
  const transport: UpdateTransport = {
    async check() { calls.push('check'); return next; },
    async download(progress) { calls.push('download'); progress(50); progress(100); },
    async stage() { calls.push('stage'); },
    quitAndInstall() { calls.push('quit'); }, ...overrides,
  };
  const options = {
    transport, disabledReason,
    async prepareInstall() { calls.push('save'); },
    changed(state: UpdateState) { states.push(state); },
    notify(kind: 'current' | 'error' | 'disabled', detail?: string) { notices.push([kind, detail]); },
    log(error: unknown) { errors.push(error); },
    schedule(callback: () => void, milliseconds: number) { tick = callback; interval = milliseconds; return () => { calls.push('cancel'); }; },
  };
  const controller = new UpdateController(options);
  return { controller, calls, states, notices, errors, options, setNext(value: typeof next) { next = value; }, tick() { tick(); }, get interval() { return interval; } };
}

test('Desktop updates check once at startup and hourly, with quiet background no-update results', async () => {
  const f = fixture(); f.setNext({ available: false, version: '0.1.0' });
  f.controller.start(); f.controller.start(); await f.controller.check();
  assert.equal(f.interval, UPDATE_CHECK_INTERVAL); assert.deepEqual(f.calls, ['check']); assert.deepEqual(f.notices, []);
  f.tick(); await f.controller.check(); assert.deepEqual(f.calls, ['check', 'check']);
  await f.controller.activate(); assert.deepEqual(f.notices, [['current', undefined]]);
  f.controller.stop(); f.controller.stop(); f.tick(); await f.controller.check();
  assert.deepEqual(f.calls, ['check', 'check', 'check', 'cancel']);
});

test('Desktop update checks share a lock and a manual request joins an ongoing background check', async () => {
  const result = deferred<{ available: boolean; version: string }>(); let checks = 0;
  const f = fixture({ check() { checks++; return result.promise; } });
  const first = f.controller.check(), second = f.controller.check(true);
  assert.equal(first, second); await Promise.resolve(); assert.equal(checks, 1);
  assert.deepEqual(updateMenu(f.controller.state), { label: 'Checking for Updates', enabled: false });
  result.resolve({ available: false, version: '0.1.0' }); await first;
  assert.deepEqual(f.notices, [['current', undefined]]);
});

test('Desktop updates download once, bound progress, and require an explicit install action', async () => {
  const downloaded = deferred<void>(), started = deferred<void>(); let progress!: (percent: number) => void;
  const f = fixture({ download(callback) { f.calls.push('download'); progress = callback; started.resolve(); return downloaded.promise; } });
  const check = f.controller.check(true); await started.promise;
  assert.equal(f.controller.state.phase, 'downloading');
  progress(60); progress(40); progress(NaN); assert.equal(f.controller.state.percent, 60);
  progress(500); assert.equal(f.controller.state.percent, 100);
  assert.equal(f.controller.activate(), check); assert.equal(f.controller.install(), check);
  downloaded.resolve(); await check;
  assert.deepEqual(f.calls, ['check', 'download']);
  assert.deepEqual(updateMenu(f.controller.state), { label: 'Update ready, click to install', enabled: true });
  assert.equal(f.controller.state.version, '0.2.0'); assert.equal(f.notices.length, 0);
});

test('Desktop update installation rechecks, stages, saves and quits once in that order', async () => {
  const saved = deferred<void>(), saving = deferred<void>(); const f = fixture();
  f.options.prepareInstall = () => { f.calls.push('save'); saving.resolve(); return saved.promise; };
  await f.controller.check(); const first = f.controller.install(), second = f.controller.install(); assert.equal(first, second);
  await saving.promise;
  assert.deepEqual(f.calls, ['check', 'download', 'check', 'stage', 'save']);
  assert.equal(f.controller.state.phase, 'installing');
  saved.resolve(); await first; await f.controller.install(); await f.controller.check();
  assert.deepEqual(f.calls, ['check', 'download', 'check', 'stage', 'save', 'quit']);
});

test('Desktop updates prefer a newer available version before installing the cached update', async () => {
  const f = fixture(); await f.controller.check(); f.setNext({ available: true, version: '0.3.0-beta.2' });
  await f.controller.install(); assert.equal(f.controller.state.version, '0.3.0-beta.2');
  assert.deepEqual(f.calls, ['check', 'download', 'check', 'download', 'stage', 'save', 'quit']);
});

test('Desktop updates do not replace a downloaded version with an older available version', async () => {
  const f = fixture(); await f.controller.check(); f.setNext({ available: true, version: '0.1.9' });
  await f.controller.install(); assert.equal(f.controller.state.version, '0.2.0');
  assert.equal(f.calls.filter(call => call === 'download').length, 1);
});

test('Desktop updates can install a verified cached version after a failed latest-version check', async () => {
  const f = fixture(); await f.controller.check(); f.options.transport.check = async () => { throw Error('Offline'); };
  await f.controller.install(); assert.deepEqual(f.calls.slice(-3), ['stage', 'save', 'quit']);
  assert.equal(f.errors.length, 1); assert.equal(f.notices.length, 0);
});

test('Desktop updates never install an uncertain cache after a replacement download fails', async () => {
  const f = fixture(); await f.controller.check(); f.setNext({ available: true, version: '0.3.0' });
  f.options.transport.download = async () => { throw Error('Checksum mismatch'); };
  await f.controller.install(); assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.controller.state.version, undefined);
  assert.equal(f.calls.includes('stage'), false); assert.equal(f.calls.includes('quit'), false);
  assert.deepEqual(f.notices, [['error', 'Checksum mismatch']]);
  f.options.transport.download = async () => {}; await f.controller.check(); assert.equal(f.controller.state.phase, 'ready');
});

test('Desktop updates keep the application open when native staging or local saving fails', async () => {
  for (const failing of ['stage', 'save'] as const) {
    const f = fixture(); await f.controller.check();
    if (failing === 'stage') f.options.transport.stage = async () => { throw Error('Signature rejected'); };
    else f.options.prepareInstall = async () => { throw Error('Local save failed'); };
    await f.controller.install(); assert.equal(f.controller.state.phase, 'ready'); assert.equal(f.calls.includes('quit'), false);
    assert.equal(f.notices[0][0], 'error');
    f.options.transport.stage = async () => {}; f.options.prepareInstall = async () => {};
    await f.controller.install(); assert.equal(f.calls.at(-1), 'quit');
  }
});

test('Desktop updates distinguish unavailable or malformed feeds from a current application', async () => {
  for (const result of [null, { available: true, version: '../../invalid' }]) {
    const f = fixture({ async check() { return result; } }); await f.controller.check(true);
    assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.notices[0][0], 'error');
    assert.equal(f.calls.includes('download'), false);
  }
  const f = fixture({ async check() { throw Error('Offline'); } }); await f.controller.check();
  assert.equal(f.notices.length, 0); assert.equal(f.errors.length, 1);
});

test('Desktop update disablement prevents transport use while explaining manual checks', async () => {
  const f = fixture({}, 'Updates are disabled by your administrator.'); f.controller.start(); await f.controller.check();
  await f.controller.activate(); await f.controller.install();
  assert.equal(f.controller.state.phase, 'disabled'); assert.deepEqual(f.calls, []);
  assert.deepEqual(f.notices, [['disabled', 'Updates are disabled by your administrator.']]);
});

test('Desktop updater shutdown prevents late network or save completion from installing', async () => {
  const result = deferred<{ available: boolean; version: string }>(); const f = fixture({ check: () => result.promise });
  const checking = f.controller.check(); await Promise.resolve(); f.controller.stop();
  result.resolve({ available: true, version: '0.2.0' }); await checking; assert.deepEqual(f.calls, []);
  const saved = deferred<void>(), saving = deferred<void>(), g = fixture(); g.options.prepareInstall = () => { saving.resolve(); return saved.promise; };
  await g.controller.check(); const installing = g.controller.install();
  await saving.promise;
  g.controller.stop(); saved.resolve(); await installing; assert.equal(g.calls.includes('quit'), false);
});

test('Desktop update commit failure rolls back prepared application state before reporting the error',async()=>{
  const order:string[]=[];const f=fixture({quitAndInstall(){throw Error('Native installation failed');}});
  f.options.prepareInstall=async()=>{order.push('prepared');};
  const options=f.options as typeof f.options&{rollbackInstall?:()=>Promise<void>};
  options.rollbackInstall=async()=>{order.push('restored');};
  options.notify=(kind,detail)=>{order.push('reported');f.notices.push([kind,detail]);};
  await f.controller.check();await f.controller.install();
  assert.deepEqual(order,['prepared','restored','reported']);assert.equal(f.controller.state.phase,'ready');
  assert.deepEqual(f.notices,[['error','Native installation failed']]);
});
