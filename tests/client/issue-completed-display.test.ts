import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completedIssueVisible,orderCompletedIssues} from '../../src/client/issue-completed-display';
test('completion windows use completion time and active cycle membership',()=>{
 const now=new Date('2026-09-07T12:00:00Z');
 const issue={id:'a',completedAt:'2026-09-05T12:00:00Z',updatedAt:now.toISOString(),cycleId:'cycle'} as any;
 assert.equal(completedIssueVisible(issue,'day',now,[]),false);
 assert.equal(completedIssueVisible(issue,'week',now,[]),true);
 assert.equal(completedIssueVisible(issue,'cycle',now,[{id:'cycle',startDate:'2026-09-01',endDate:'2026-09-10'} as any]),true);
 assert.equal(completedIssueVisible(issue,'cycle',now,[]),false);
});
test('recency ordering preserves open issue slots and orders completed issues newest first',()=>{
 const items=[{id:'old',statusId:'done',completedAt:'2026-09-01'},{id:'open',statusId:'open'},{id:'new',statusId:'done',completedAt:'2026-09-06'}] as any;
 assert.deepEqual(orderCompletedIssues(items,[{id:'done',type:'completed'} as any],true).map(i=>i.id),['new','open','old']);
 assert.equal(orderCompletedIssues(items,[],false),items);
});
