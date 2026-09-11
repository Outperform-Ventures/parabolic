import test from'node:test';import assert from'node:assert/strict';import{matchesFilter as client,type FilterSpec}from'../../src/client/query';import{matchesFilter as server}from'../../src/server/repository';import{resolveCalendarFilter}from'../../src/shared/relative-date-filter';import{shiftCalendarDate}from'../../src/shared/date-filter-range';
test('calendar ranges include the first date, exclude the stored end, and agree before/after',()=>{
 const dates=['2026-09-04','2026-09-05','2026-09-06','2026-09-07',null];
 for(const operator of ['within','eq','before','after'])for(const dueDate of dates){const filter:FilterSpec={match:'all',conditions:[{field:'dueDate',operator,value:['2026-09-05','2026-09-07']}]};const expected=dueDate!==null&&(operator==='before'?dueDate<'2026-09-05':operator==='after'?dueDate>='2026-09-07':dueDate>='2026-09-05'&&dueDate<'2026-09-07');assert.equal(client({dueDate} as any,filter),expected);assert.equal(server({dueDate},filter),expected)}
 assert.equal(shiftCalendarDate('2024-02-29',1),'2024-03-01');assert.equal(shiftCalendarDate('2026-03-01',-1),'2026-02-28');assert.equal(shiftCalendarDate('2026-02-30',1),undefined);
});
test('relative range bounds resolve together and invalid ranges do not widen matches',()=>{
 const filter:FilterSpec={match:'all',conditions:[{field:'dueDate',operator:'within',value:['P0D','P1W']}]},clock={now:new Date('2026-09-06T02:00:00Z'),timeZone:'America/Los_Angeles'};
 assert.deepEqual(resolveCalendarFilter(filter,clock).conditions[0].value,['2026-09-05','2026-09-12']);assert(client({dueDate:'2026-09-05'} as any,filter,undefined,undefined,undefined,clock));assert(!client({dueDate:'2026-09-12'} as any,filter,undefined,undefined,undefined,clock));
 for(const value of [[],['2026-09-06'],['2026-09-07','2026-09-05'],['2026-02-30','2026-03-05'],['2026-09-05','2026-09-05']]){const spec={conditions:[{field:'dueDate',operator:'within',value}],match:'all' as const};assert(!client({dueDate:'2026-09-06'} as any,spec));assert(!server({dueDate:'2026-09-06'},spec))}
});
