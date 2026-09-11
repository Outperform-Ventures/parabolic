import test from 'node:test';import assert from 'node:assert/strict';import {dueDatePresentation} from '../../src/client/due-date-data';
test('due date indicators use calendar days and include today and the next week',()=>{
 const now=new Date(2026,8,6,15);for(const [value,days,tone] of [['2026-09-05',-1,'urgent'],['2026-09-06',0,'urgent'],['2026-09-07',1,'soon'],['2026-09-13',7,'soon'],['2026-09-14',8,'later']] as const){const result=dueDatePresentation(value,now)!;assert.equal(result.days,days);assert.equal(result.tone,tone);assert.equal(result.date.getDate(),Number(value.slice(-2)))}
 assert.equal(dueDatePresentation('2026-09-05',now)?.relative,'1 day overdue');assert.equal(dueDatePresentation('invalid',now),null);
 assert.equal(dueDatePresentation('2026-03-09',new Date(2026,2,7,23))?.days,2);
});
