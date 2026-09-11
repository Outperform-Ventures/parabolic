import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeferredSave, PendingSaves } from '../../src/client/pending-saves';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

test('Restart save barrier flushes debounced edits immediately and orders edits behind a slow write', async () => {
  const coordinator = new PendingSaves(), started = deferred(), saving = deferred(), writes: string[] = [];
  const queue = new DeferredSave<string>(async value => { writes.push(value); if (value === 'first') { started.resolve(); await saving.promise; } }, error => assert.fail(String(error)), 60_000, coordinator);
  queue.queue('first'); const flush = coordinator.flush(); await started.promise;
  assert.equal(coordinator.flush(), flush); assert.equal(queue.dirty, true);
  queue.queue('second'); queue.queue('third'); saving.resolve(); await flush;
  assert.deepEqual(writes, ['first', 'third']); assert.equal(queue.dirty, false);
  await coordinator.flush(); assert.equal(writes.length, 2);
});

test('Restart save barrier preserves failed edits after editor unmount and retries without typing again', async () => {
  const coordinator = new PendingSaves(), failed = deferred(), writes: string[] = []; let unavailable = true;
  const queue = new DeferredSave<string>(async value => { if (unavailable) throw Error('Disk full'); writes.push(value); }, () => failed.resolve(), 60_000, coordinator);
  queue.queue('Keep this draft'); queue.release(); await failed.promise;
  assert.equal(queue.dirty, true); await assert.rejects(coordinator.flush(), AggregateError);
  unavailable = false; await coordinator.flush(); assert.deepEqual(writes, ['Keep this draft']); assert.equal(queue.dirty, false);
});

test('Restart save barrier waits for every editor and includes newly registered edits during a save', async () => {
  const coordinator = new PendingSaves(), started = deferred(), gate = deferred(), writes: string[] = [];
  const first = new DeferredSave<string>(async value => { started.resolve(); await gate.promise; writes.push(value); }, error => assert.fail(String(error)), 60_000, coordinator);
  first.queue('one'); const flushing = coordinator.flush(); await started.promise;
  const second = new DeferredSave<string>(async value => { writes.push(value); }, error => assert.fail(String(error)), 60_000, coordinator);
  second.queue('two'); gate.resolve(); await flushing;
  assert.deepEqual(writes.sort(), ['one', 'two']);
});

test('Restart save barrier reports errors only after other local writes settle', async () => {
  const coordinator = new PendingSaves(), gate = deferred(), started = deferred(); let settled = false;
  const unregister = coordinator.register(async () => { throw Error('Quota exceeded'); });
  const other = coordinator.register(async () => { started.resolve(); await gate.promise; settled = true; });
  const result = coordinator.flush(); const rejected = assert.rejects(result, error => error instanceof AggregateError && error.errors[0].message === 'Quota exceeded');
  await started.promise; assert.equal(settled, false); gate.resolve(); await rejected; assert.equal(settled, true);
  unregister(); other(); await coordinator.flush();
});

test('Restart save barrier retries the newest text after an older save fails', async () => {
  const coordinator = new PendingSaves(), started = deferred(), gate = deferred(), saved: string[] = [];
  const queue = new DeferredSave<string>(async value => { if (value === 'old') { started.resolve(); await gate.promise; throw Error('Old write failed'); } saved.push(value); }, error => assert.fail(String(error)), 60_000, coordinator);
  queue.queue('old'); const first = coordinator.flush(), rejected = assert.rejects(first, AggregateError); await started.promise;
  queue.queue('new'); gate.resolve(); await rejected; assert.equal(queue.dirty, true);
  await coordinator.flush(); assert.deepEqual(saved, ['new']); assert.equal(queue.dirty, false);
});

test('Restart waits for active uploads and saves the editor changes they produce',async()=>{
  const coordinator=new PendingSaves(),gate=deferred(),started=deferred(),writes:string[]=[];
  const queue=new DeferredSave<string>(async value=>{writes.push(value);},error=>assert.fail(String(error)),60_000,coordinator);
  const upload=coordinator.track(async()=>{started.resolve();await gate.promise;queue.queue('Uploaded attachment reference');return 'uploaded';});
  await started.promise;let finished=false;const saving=coordinator.flush().then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);gate.resolve();assert.equal(await upload,'uploaded');await saving;
  assert.deepEqual(writes,['Uploaded attachment reference']);
});

test('An active upload failure rejects the waiting restart without leaving a stale registration',async()=>{
  const coordinator=new PendingSaves(),gate=deferred(),started=deferred();
  const uploading=coordinator.track(async()=>{started.resolve();await gate.promise;throw Error('Upload failed');});
  const rejectedUpload=assert.rejects(uploading,/Upload failed/);await started.promise;
  const saving=coordinator.flush(),rejectedSave=assert.rejects(saving,AggregateError);
  await new Promise<void>(resolve=>setImmediate(resolve));gate.resolve();await Promise.all([rejectedUpload,rejectedSave]);
  await coordinator.flush();
});
