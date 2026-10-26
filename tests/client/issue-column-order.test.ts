import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueColumnDefinitions, normalizeIssueColumnOrder, normalizeIssueColumnWidths, issueColumnGrid, moveIssueColumn, isIssueColumnVisible, setIssueColumnVisible, issueColumnSettingsFingerprint, withSavedIssueColumns } from '../../src/client/issue-column-order';

test('legacy and malformed column preferences normalize without losing fields', () => {
  const defaults = ['priority', 'identifier', 'statusId', 'title', 'projectId'];
  assert.deepEqual(normalizeIssueColumnOrder(undefined, defaults), defaults);
  assert.deepEqual(normalizeIssueColumnOrder('title', defaults), defaults);
  assert.deepEqual(normalizeIssueColumnOrder(['title', 'title', 'bogus', 4, 'priority'], defaults), ['title', 'priority', 'identifier', 'statusId', 'projectId']);
});

test('moving visible columns retains hidden columns and supports either drop edge', () => {
  const original = ['priority', 'identifier', 'statusId', 'title', 'projectId'];
  assert.deepEqual(moveIssueColumn(original, 'projectId', 'priority', 'before'), ['projectId', 'priority', 'identifier', 'statusId', 'title']);
  assert.deepEqual(moveIssueColumn(original, 'priority', 'title', 'after'), ['identifier', 'statusId', 'title', 'priority', 'projectId']);
  assert.deepEqual(moveIssueColumn(original, 'bogus', 'title', 'after'), original);
  assert.deepEqual(moveIssueColumn(original, 'title', 'title', 'after'), original);
  assert.deepEqual(original, ['priority', 'identifier', 'statusId', 'title', 'projectId']);
});

test('every field has one slot, including Customers and custom fields', () => {
  const definitions = issueColumnDefinitions(['customFields.reference', 'duration'], [['customFields.reference', 'Reference']]);
  const ids = definitions.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('effectiveCustomerIds'));
  assert.equal(definitions.find(([id]) => id === 'customFields.reference')?.[1], 'Reference');
});

test('visibility supports default-on fields and keeps unrelated settings intact', () => {
  for (const field of ['priority', 'title', 'estimate', 'effectiveCustomerIds', 'customFields.reference']) {
    const original = ['identifier', 'priority', 'estimate', 'effectiveCustomerIds', 'customFields.reference'];
    const hidden = setIssueColumnVisible(original, field, false);
    assert.equal(isIssueColumnVisible(field, hidden, true), false);
    assert.ok(hidden.includes('identifier'));
    const shown = setIssueColumnVisible(hidden, field, true);
    assert.equal(isIssueColumnVisible(field, shown, true), true);
    assert.equal(new Set(shown).size, shown.length);
    assert.deepEqual(setIssueColumnVisible(shown, field, true), shown);
  }
  assert.equal(isIssueColumnVisible('title', []), true);
  assert.equal(isIssueColumnVisible('estimate', [], true), true);
  assert.equal(isIssueColumnVisible('effectiveCustomerIds', []), true);
});

test('saved column settings preserve unrelated display settings and explicit resets', () => {
  const original = { groupBy: 'priority', orderBy: 'dueDate', summaryOpen: true, columnOrder: ['title', 'priority'], properties: ['priority'] };
  const saved = withSavedIssueColumns(original, { properties: ['identifier', 'hideTitle', 'hideCustomers'] });
  assert.deepEqual(saved, { ...original, columnOrder: [], columnWidths: {}, properties: ['identifier', 'hideTitle', 'hideCustomers'] });
  assert.deepEqual(original.columnOrder, ['title', 'priority']);
  assert.equal(issueColumnSettingsFingerprint({ properties: ['priority', 'identifier'] }), issueColumnSettingsFingerprint({ properties: ['identifier', 'priority'], columnOrder: issueColumnDefinitions(['priority', 'identifier']).map(([id]) => id) }));
  assert.notEqual(issueColumnSettingsFingerprint({ properties: ['priority'] }), issueColumnSettingsFingerprint({ properties: [] }));
});

test('width preferences reject malformed CSS values, clamp sizes and retain hidden/custom fields', () => {
  assert.deepEqual(normalizeIssueColumnWidths(null), {});
  assert.deepEqual(normalizeIssueColumnWidths([200]), {});
  assert.deepEqual(normalizeIssueColumnWidths({ priority: 1, title: 9000, projectId: 176.7, estimate: '80px', statusId: Infinity, createdAt: -12, bogus: 100, 'customFields.reference': 130 }),
    { 'customFields.reference': 130, priority: 32, projectId: 177, title: 1600 });
});

test('custom widths fix title sizing and participate in saved-view change detection', () => {
  assert.match(issueColumnGrid(['priority', 'title'], {}).tracks, /minmax\(260px, 1fr\)/);
  assert.equal(issueColumnGrid(['priority', 'title'], { priority: 40, title: 320 }).tracks, '18px 40px 320px');
  assert.equal(issueColumnGrid(['priority', 'title'], { priority: 40, title: 320 }).minWidth, 436);
  const base = { properties: ['priority'], columnOrder: ['priority', 'title'] };
  assert.notEqual(issueColumnSettingsFingerprint(base), issueColumnSettingsFingerprint({ ...base, columnWidths: { priority: 40 } }));
  assert.equal(issueColumnSettingsFingerprint({ ...base, columnWidths: { priority: 40, title: 320 } }), issueColumnSettingsFingerprint({ ...base, columnWidths: { title: 320, priority: 40 } }));
  const saved = withSavedIssueColumns({ groupBy: 'statusId', columnWidths: { priority: 40 } }, { ...base, columnWidths: { title: 320 } });
  assert.deepEqual(saved.columnWidths, { title: 320 });
  assert.equal(saved.groupBy, 'statusId');
  assert.deepEqual(withSavedIssueColumns(saved, { ...base, columnWidths: {} }).columnWidths, {});
});
