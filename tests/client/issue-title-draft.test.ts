import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IssueTitleDraft} from '../../src/client/issue-title-draft';
import {DurableDraftStorage} from '../../src/client/durable-draft-storage';
import {PendingSaves} from '../../src/client/pending-saves';

function fixture() {
  const coordinator = new PendingSaves(), records = new Map<string, string>(), writes: string[] = [];
  const storage = new DurableDraftStorage(() => ({getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); }}), coordinator);
  let title = 'Original';
  const draft = new IssueTitleDraft('issue', storage, () => title, async value => { writes.push(value); title = value; }, coordinator);
  return {coordinator, records, writes, storage, draft};
}
test('title keystrokes journal without writes and commit only the completed edit', async () => {
  const f = fixture();
  for (const title of ['O', 'On', 'One', 'One edit']) f.draft.change(title);
  assert.deepEqual(f.writes, []);
  assert.equal(f.records.get('issue'), '{"title":"One edit"}');
  await Promise.all([f.draft.flush(), f.draft.flush()]);
  assert.deepEqual(f.writes, ['One edit']);
  assert.equal(f.draft.dirty, false); assert.equal(f.records.get('issue'), '{}');
});
test('reverted and empty edits do not emit updates', async () => {
  const f = fixture();
  f.draft.change('Temporary'); f.draft.change('Original'); await f.draft.flush();
  f.draft.change('   '); await f.draft.flush();
  assert.deepEqual(f.writes, []); assert.equal(f.draft.dirty, false);
});
test('restart flushes unfinished typing; recovery is idempotent and keeps other journal fields', async () => {
  const f = fixture();
  f.records.set('issue', '{"title":"Recovered","description":"legacy"}');
  assert.equal(f.draft.recover(), 'Recovered'); assert.equal(f.draft.recover(), undefined);
  await f.coordinator.flush();
  assert.deepEqual(f.writes, ['Recovered']);
  assert.equal(f.records.get('issue'), '{"description":"legacy"}');
  f.draft.change('Next session'); await f.coordinator.flush();
  assert.deepEqual(f.writes, ['Recovered', 'Next session']);
});
test('typing during an in-flight save stays draft-only until another commit', async () => {
  const f = fixture(); let release!: () => void, title = 'Original';
  const gate = new Promise<void>(resolve => { release = resolve; });
  const draft = new IssueTitleDraft('issue', f.storage, () => title, async value => { f.writes.push(value); await gate; title = value; }, f.coordinator);
  draft.change('First'); const saving = draft.flush(); await Promise.resolve();
  draft.change('Second'); release(); await saving;
  assert.deepEqual(f.writes, ['First']); assert.equal(draft.dirty, true);
  assert.equal(f.records.get('issue'), '{"title":"Second"}');
  await draft.flush(); assert.deepEqual(f.writes, ['First', 'Second']);
});
test('failed commits retain the latest draft and retry through the restart barrier', async () => {
  const f = fixture(); let fail = true;
  const draft = new IssueTitleDraft('issue', f.storage, () => 'Original', async value => { if (fail) throw Error('Disk full'); f.writes.push(value); }, f.coordinator);
  draft.change('First'); await assert.rejects(draft.flush(), /Disk full/);
  draft.change('Newest'); await assert.rejects(f.coordinator.flush(), AggregateError);
  assert.equal(f.records.get('issue'), '{"title":"Newest"}');
  fail = false; await f.coordinator.flush(); assert.deepEqual(f.writes, ['Newest']); assert.equal(draft.dirty, false);
});
test('storage failure retains typing in memory and reports that the draft is not durable', async () => {
  const coordinator = new PendingSaves(); let fail = true, record = '', saved = '';
  const storage = new DurableDraftStorage(() => ({getItem: () => record || null, setItem: (_key, value) => { if (fail) throw Error('Quota'); record = value; }}), coordinator);
  const draft = new IssueTitleDraft('issue', storage, () => saved, async value => { saved = value; }, coordinator);
  assert.equal(draft.change('Keep this title'), false);
  assert.equal(storage.get('issue'), '{"title":"Keep this title"}');
  await assert.rejects(coordinator.flush(), AggregateError);
  fail = false; await coordinator.flush(); assert.equal(saved, 'Keep this title'); assert.equal(record, '{}');
});
