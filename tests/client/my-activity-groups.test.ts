import test from 'node:test';
import assert from 'node:assert/strict';
import {myActivityGroupDate,myIssueTabs} from '../../src/client/my-issues-state';
test('My Issues keeps Activity fourth and groups older activity into local Sunday weeks',()=>{
 assert.deepEqual(myIssueTabs,['Assigned','Created','Subscribed','Activity','Shared']);
 const now=+new Date(2026,8,16,12),at=(day:number,hour=12)=>new Date(2026,8,day,hour).toISOString();
 assert.equal(myActivityGroupDate(at(16),now),'2026-09-16');
 assert.equal(myActivityGroupDate(at(6,0),now),'2026-09-06');
 assert.equal(myActivityGroupDate(at(7),now),'2026-09-07');
 assert.equal(myActivityGroupDate(at(5,23),now),'2026-08-30');
 assert.equal(myActivityGroupDate(at(1),now),'2026-08-30');
 const dstNow=+new Date(2026,2,18,12);assert.equal(myActivityGroupDate(new Date(2026,2,8,3).toISOString(),dstNow),'2026-03-08');
 assert.equal(myActivityGroupDate('invalid',now),'');
});

test('native relative Activity headings round elapsed local days and retain Sunday weekly groups',async()=>{const {myActivityGroupLabel}=await import('../../src/client/my-issues-state');const now=+new Date(2026,8,7,18);assert.equal(myActivityGroupLabel('2026-09-07',now),'Today');assert.equal(myActivityGroupLabel('2026-09-06',now),'Yesterday');assert.equal(myActivityGroupLabel('2026-09-05',now),'3 days ago');assert.equal(myActivityGroupLabel('2026-08-23',now),'2 weeks ago');const morning=+new Date(2026,8,7,9);assert.equal(myActivityGroupLabel('2026-09-05',morning),'2 days ago');});

test('Activity date labels switch strictly beyond the native six-month bounds',async()=>{const {myActivityDateLabel}=await import('../../src/client/my-issues-state');const now=+new Date(2026,8,7,18);assert.equal(myActivityDateLabel(new Date(2026,2,1).toISOString(),now),'Mar 1');assert.equal(myActivityDateLabel(new Date(2026,1,28,23,59,59).toISOString(),now),'Feb 2026');assert.equal(myActivityDateLabel(new Date(2027,2,7,18).toISOString(),now),'Mar 7');assert.equal(myActivityDateLabel(new Date(2027,2,7,18,0,1).toISOString(),now),'Mar 2027');});
