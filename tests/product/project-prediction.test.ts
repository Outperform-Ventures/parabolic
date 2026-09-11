import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCompletionPrediction, projectProgressVelocity } from '../../src/shared/project-prediction';

test('velocity uses recent weighted deltas and does not penalize an incomplete current week', () => {
  assert.equal(projectProgressVelocity([], 1.25), 1.25);
  assert.equal(projectProgressVelocity([2], 8), 6);
  assert.equal(projectProgressVelocity([2, 8], 9), 4);
  assert.equal(projectProgressVelocity([2, 8], 16), 6);
  assert.equal(projectProgressVelocity([100, 110, 120, 130, 140, 145, 147, 149], 149), 4);
});

test('prediction distinguishes absent history, no progress, stale work and completed scope', () => {
  const input = { started: true, completed: false, hasIssueHistory: true, issueCount: 4, completedHistory: [2, 8], scope: 16, progress: 9, now: 0 };
  assert.equal(projectCompletionPrediction({ ...input, started: false }).type, 'notStarted');
  assert.equal(projectCompletionPrediction({ ...input, completed: true }).type, 'completed');
  assert.equal(projectCompletionPrediction({ ...input, hasIssueHistory: false }).type, 'tooEarly');
  assert.equal(projectCompletionPrediction({ ...input, issueCount: 0 }).type, 'tooEarly');
  assert.equal(projectCompletionPrediction({ ...input, completedHistory: [0, 0], progress: 0 }).type, 'stale');
  assert.equal(projectCompletionPrediction({ ...input, completedHistory: [8, 8, 8], progress: 8 }).type, 'stale');
  assert.equal(projectCompletionPrediction({ ...input, completedHistory: [8, 8, 8], progress: 9 }).type, 'prediction');
  assert.equal(projectCompletionPrediction({ ...input, progress: 16 }).type, 'completed');
});

test('forecast has minimum two-point weekly velocity and forty-percent uncertainty', () => {
  const result = projectCompletionPrediction({ started: true, completed: false, hasIssueHistory: true, issueCount: 2, completedHistory: [1], scope: 3, progress: 1, now: 1000 });
  assert.equal(result.weeklyVelocity, 2);
  assert.equal(result.date, 1000 + 7 * 86400000);
  assert.equal(result.optimistic, 1000 + 4 * 86400000);
  assert.equal(result.pessimistic, 1000 + 9 * 86400000);
});
