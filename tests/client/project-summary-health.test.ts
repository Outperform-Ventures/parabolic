import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesProjectSummary, projectSummaryValues} from '../../src/client/features/project-summary-health';

const updates = new Map<string, any>([
  ['current', {id: 'update-current', projectId: 'current', health: 'On track'}],
  ['stale', {id: 'update-stale', projectId: 'stale', health: 'At risk'}],
  ['disabled', {id: 'update-disabled', projectId: 'disabled', health: 'Off track'}],
]);

test('project Health summary honors missing and not-expected update states', () => {
  const current = {id: 'current', updateHealthStatus: 'current'} as any;
  const stale = {id: 'stale', updateHealthStatus: 'missing'} as any;
  const disabled = {id: 'disabled', updateHealthStatus: 'notExpected'} as any;

  assert.deepEqual(projectSummaryValues(current, 'Health', updates), ['On track']);
  assert.deepEqual(projectSummaryValues(stale, 'Health', updates), ['Update missing']);
  assert.deepEqual(projectSummaryValues(disabled, 'Health', updates), ['No update expected']);
  assert.equal(matchesProjectSummary(disabled, {tab: 'Health', value: 'No update expected'}, updates), true);
  assert.equal(matchesProjectSummary(disabled, {tab: 'Health', value: 'Off track'}, updates), false);
});
