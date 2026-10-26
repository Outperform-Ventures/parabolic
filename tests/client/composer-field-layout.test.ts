import {test} from 'node:test';
import assert from 'node:assert/strict';
import {composerFields, normalizeComposerFieldLayout, visibleComposerFields} from '../../src/client/composer-field-layout';
const context = {customized: true, inline: false, expanded: false, estimateDisabled: false, projectId: 'project'};
test('composer layout normalizes unknown, duplicate and missing fields without losing newly supported fields', () => {
  const layout = normalizeComposerFieldLayout({order: ['dueDate', 'priority', 'priority', 'unknown'], hidden: ['labelIds', 'labelIds', 'unknown']});
  assert.deepEqual(layout.order.slice(0, 2), ['dueDate', 'priority']);
  assert.equal(layout.order.length, composerFields.length); assert.deepEqual(layout.hidden, ['labelIds']);
  assert.equal(normalizeComposerFieldLayout(null).order[0], 'customers');
  assert.deepEqual(normalizeComposerFieldLayout({order: 5, hidden: null}).hidden, ['cycleId', 'dueDate', 'recurrence']);
});
test('configured visibility and ordering apply equally to compact, expanded and inline composers', () => {
  const layout = normalizeComposerFieldLayout({order: ['dueDate', 'priority'], hidden: ['customers', 'labelIds']});
  const visible = visibleComposerFields(layout, context);
  assert.deepEqual(visible.slice(0, 2), ['dueDate', 'priority']); assert.ok(!visible.includes('customers'));
  assert.deepEqual(visibleComposerFields(layout, {...context, expanded: true}), visible);
  assert.deepEqual(visibleComposerFields(layout, {...context, inline: true}), visible);
});
test('team and project availability never erases remembered settings; hiding populated fields does not change values', () => {
  const layout = normalizeComposerFieldLayout({hidden: ['dueDate', 'recurrence']}), before = structuredClone(layout);
  const visible = visibleComposerFields(layout, {...context, projectId: undefined, estimateDisabled: true, dueDate: '2026-10-01', recurrence: {frequency: 'week'}});
  for (const field of ['milestoneId', 'estimate', 'dueDate', 'recurrence']) assert.ok(!visible.includes(field as any));
  assert.deepEqual(layout, before);
  assert.ok(visibleComposerFields(layout, context).includes('milestoneId'));
});
test('unconfigured composers preserve existing compact, expanded, inline and populated-date defaults', () => {
  const layout = normalizeComposerFieldLayout(undefined);
  assert.ok(!visibleComposerFields(layout, {...context, customized: false}).includes('cycleId'));
  assert.ok(visibleComposerFields(layout, {...context, customized: false, expanded: true}).includes('cycleId'));
  assert.ok(!visibleComposerFields(layout, {...context, customized: false, inline: true}).includes('projectId'));
  assert.ok(visibleComposerFields(layout, {...context, customized: false, dueDate: '2026-10-01'}).includes('dueDate'));
});
