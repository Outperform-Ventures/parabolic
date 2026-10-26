import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveSection, mergeSectionOrder, orderSections } from '../../src/client/section-order';

test('section drops insert before or after without reversing neighbors', () => {
  const ids = ['progress', 'todo', 'backlog', 'done'];
  assert.deepEqual(moveSection(ids, 'done', 'progress', 'before'), ['done', 'progress', 'todo', 'backlog']);
  assert.deepEqual(moveSection(ids, 'progress', 'backlog', 'after'), ['todo', 'backlog', 'progress', 'done']);
  assert.equal(moveSection(ids, 'missing', 'todo', 'after'), ids);
  assert.equal(moveSection(ids, 'todo', 'todo', 'before'), ids);
});

test('filtered-out groups retain their slots and new groups append', () => {
  assert.deepEqual(mergeSectionOrder(['a', 'hidden', 'b', 'absent'], ['b', 'a', 'new']), ['b', 'hidden', 'a', 'absent', 'new']);
  assert.deepEqual(mergeSectionOrder(undefined, ['b', 'a', 'a']), ['b', 'a']);
  const rows = [{ id: 'a' }, { id: 'new' }, { id: 'b' }, { id: 'other' }];
  assert.deepEqual(orderSections(rows, ['b', 'a']).map(x => x.id), ['b', 'a', 'new', 'other']);
  assert.equal(rows[0].id, 'a');
});
