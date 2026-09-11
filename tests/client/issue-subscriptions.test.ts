import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSubscribedBy,targetsIssue} from '../../src/shared/issue-subscriptions';

test('issue subscription identity excludes threads, deleted records, other users and other issues',()=>{
 const issue={id:'issue',subscriberIds:['direct'],subscriptionUserIds:['remote']};
 const records=[{userId:'legacy',issueId:'issue'},{userId:'modern',entityKind:'issues',entityId:'issue'},{userId:'thread',entityKind:'comments',entityId:'issue'},{userId:'removed',issueId:'issue',deletedAt:'2026-01-01'},{userId:'other',issueId:'different'}];
 for(const id of ['direct','legacy','modern','remote'])assert.equal(issueSubscribedBy(issue,records,id),true,id);
 for(const id of ['thread','removed','other',undefined])assert.equal(issueSubscribedBy(issue,records,id),false,id??"anonymous");
 assert.equal(targetsIssue({entityKind:'comments',issueId:'issue',entityId:'comment'},'issue'),false);
});
