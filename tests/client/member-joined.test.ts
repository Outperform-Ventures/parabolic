import test from 'node:test';import assert from 'node:assert/strict';import {memberJoinedLabel} from '../../src/client/member-joined';
test('observed membership date wins over local import timestamp',()=>{
 assert.equal(memberJoinedLabel({joinedDisplay:'Jul 20, 1:01:47 PM'} as any,{createdAt:'2026-09-07T21:00:43Z',sourceTransfer:{timestampsObserved:false}} as any),'Jul 20, 1:01:47 PM');
 assert.equal(memberJoinedLabel({} as any,{createdAt:'2026-09-07T21:00:43Z',sourceTransfer:{timestampsObserved:false}} as any),undefined);
});
test('ordinary membership timestamps remain available and invalid dates stay absent',()=>{
 const value='2026-07-20T17:01:47Z';assert.equal(memberJoinedLabel({} as any,{createdAt:value} as any),new Date(value).toLocaleDateString());
 assert.equal(memberJoinedLabel({joinedAt:'bad-date'} as any,undefined),undefined);
});
