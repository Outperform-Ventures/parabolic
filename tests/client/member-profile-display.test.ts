import test from 'node:test';
import assert from 'node:assert/strict';
import {profileIssueDisplay} from '../../src/client/my-issues-state.ts';

test('member profile Assigned and Created use retained native display defaults',()=>{
 const assigned=profileIssueDisplay('Assigned'),created=profileIssueDisplay('Created');
 assert.equal(assigned.groupBy,'statusId');
 assert.equal(assigned.orderBy,'priority');
 assert.equal(created.groupBy,'none');
 assert.equal(created.orderBy,'createdAt');
 assert.equal(created.direction,'desc');
 assert.equal(created.completedWindow,'all');
 assert.equal(created.nestedSubIssues,true);
 assert.deepEqual(created.properties,['identifier','statusId','assigneeId','priority','projectId','dueDate','milestoneId','estimate','labelIds','links','customerCount','customerRevenue','timeInStatus','createdAt','updatedAt']);
});
