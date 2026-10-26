import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSidebarLayout, sidebarDragLayout, sidebarMaxWidth, sidebarLayoutKey } from '../../src/client/sidebar-layout';

test('sidebar preferences safely normalize malformed or old local storage', () => {
  for (const input of [null, false, 'wide', {}, { width: '300' }, { width: NaN }, { width: Infinity }]) {
    assert.deepEqual(normalizeSidebarLayout(input), { width: null, collapsed: false });
  }
  assert.deepEqual(normalizeSidebarLayout({ width: -20, collapsed: true }), { width: 180, collapsed: true });
  assert.deepEqual(normalizeSidebarLayout({ width: 5000 }), { width: 480, collapsed: false });
  assert.deepEqual(normalizeSidebarLayout({ width: 310.7, collapsed: 'true' }), { width: 311, collapsed: false });
});

test('resizing leaves space for content and collapse remembers the last width', () => {
  const previous = { width: 300, collapsed: false };
  assert.deepEqual(sidebarDragLayout(90, 1200, previous), { width: 300, collapsed: true });
  assert.deepEqual(sidebarDragLayout(-100, 1200, previous), { width: 300, collapsed: true });
  assert.deepEqual(sidebarDragLayout(140, 1200, previous), { width: 180, collapsed: false });
  assert.deepEqual(sidebarDragLayout(390, 1200, previous), { width: 390, collapsed: false });
  assert.deepEqual(sidebarDragLayout(900, 800, previous), { width: 440, collapsed: false });
  assert.equal(sidebarMaxWidth(500), 180);
  assert.equal(sidebarMaxWidth(1600), 480);
  assert.deepEqual(previous, { width: 300, collapsed: false });
});

test('local sidebar choices are scoped to both the user and workspace', () => {
  assert.notEqual(sidebarLayoutKey('u1', 'w1'), sidebarLayoutKey('u1', 'w2'));
  assert.notEqual(sidebarLayoutKey('u1', 'w1'), sidebarLayoutKey('u2', 'w1'));
});
