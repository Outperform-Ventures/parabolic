import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,calendarDrop,dateDay,dayDate,moveSchedule,scheduleDependencies,scheduleRange,shiftPeriod} from '../../src/client/features/schedule-data';
import {dashboardStarter} from '../../src/client/features/dashboard-presets';
import {calculateInsight} from '../../src/client/features/insight-data';
import {emptyData,type Entity} from '../../src/shared/types';
const entity=(id:string,fields:any={}):Entity=>({id,workspaceId:'w',version:1,createdAt:'2026-09-01',updatedAt:'2026-09-01',...fields});
test('date arithmetic rejects invalid days and spans DST and leap days exactly',()=>{
 assert.equal(dateDay('2026-02-30'),null);assert.equal(dateDay('bad'),null);
 assert.equal(dayDate(dateDay('2024-02-28')!+1),'2024-02-29');
 assert.equal(dayDate(dateDay('2026-03-07')!+2),'2026-03-09');
 assert.equal(shiftPeriod('2026-01-31',1,'month'),'2026-02-01');
 assert.equal(shiftPeriod('2026-12-20',1,'quarter'),'2027-03-01');
 assert.equal(calendarDays('2026-09-12','month').length,42);
 assert.equal(dayDate(calendarDays('2026-09-12','week')[0]),'2026-09-07');
});
test('calendar drops preserve ranges and do not invert partially scheduled issues',()=>{
 const item=entity('a',{startDate:'2026-09-10',dueDate:'2026-09-12'});
 assert.deepEqual(calendarDrop(item,'dueDate',dateDay('2026-09-20')!,'dueDate'),{startDate:'2026-09-18',dueDate:'2026-09-20'});
 assert.deepEqual(moveSchedule(item,'dueDate',-2),{startDate:'2026-09-08',dueDate:'2026-09-10'});
 assert.deepEqual(calendarDrop(entity('b',{startDate:'2026-09-12'}),'dueDate',dateDay('2026-09-10')!,'dueDate'),{startDate:'2026-09-10',dueDate:'2026-09-10'});
 assert.equal(scheduleRange(entity('c'),'dueDate'),null);
});
test('dependencies deduplicate inverse edges and omit inaccessible targets',()=>{
 const a=entity('a',{relations:[{type:'blocks',issueId:'b'},{type:'blocks',issueId:'private'}]}),b=entity('b',{relations:[{type:'blockedBy',issueId:'a'}]});
 assert.deepEqual(scheduleDependencies([a,b]),[{from:'a',to:'b'}]);
});
test('dashboard overview counts only open work and assigned customers without requests',()=>{
 const data=emptyData();data.statuses=[entity('open',{name:'Todo',type:'unstarted'}),entity('done',{name:'Done',type:'completed'})];data.customers=[entity('c',{name:'Customer A'})];data.projects=[entity('p',{directCustomerIds:['c']})];
 data.issues=[entity('a',{statusId:'open',projectId:'p',estimate:4,dueDate:'2026-09-10'}),entity('b',{statusId:'done',estimate:10,dueDate:'2026-09-10'}),entity('c',{statusId:'open',estimate:2,dueDate:'2026-09-14'})];
 const widgets=dashboardStarter('overview',data.statuses),now=Date.parse('2026-09-12T12:00:00Z');
 assert.equal(widgets.length,5);assert.equal(dashboardStarter('blank',data.statuses).length,0);
 assert.equal(calculateInsight(data,widgets[0],undefined,now).total,2);
 assert.equal(calculateInsight(data,widgets[1],undefined,now).total,1);
 assert.equal(calculateInsight(data,widgets[2],undefined,now).total,1);
 assert.equal(calculateInsight(data,widgets[4],undefined,now).buckets.find(b=>b.label==='Customer A')?.value,4);
});
