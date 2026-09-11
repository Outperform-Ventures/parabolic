import test from 'node:test';import assert from 'node:assert/strict';
import{resolveRelativeDate}from'../../src/shared/relative-date-filter';
test('relative date filters use the viewer calendar day, including opposite sides of midnight',()=>{
 const now=new Date('2026-09-06T02:00:00Z');
 assert.equal(resolveRelativeDate('P0D',{now,timeZone:'America/Los_Angeles'}),'2026-09-05');
 assert.equal(resolveRelativeDate('P0D',{now,timeZone:'Asia/Tokyo'}),'2026-09-06');
 assert.equal(resolveRelativeDate('P1W',{now,timeZone:'America/Los_Angeles'}),'2026-09-12');
 assert.equal(resolveRelativeDate('-P3D',{now,timeZone:'Asia/Tokyo'}),'2026-09-03');
 assert.equal(resolveRelativeDate('P1D',{now:new Date('2026-09-07T02:00:00Z'),timeZone:'Asia/Tokyo'}),'2026-09-08');
});
test('calendar month/year arithmetic clamps the day and preserves calendar days across DST',()=>{
 const resolve=(value:string,at:string,zone='America/New_York')=>resolveRelativeDate(value,{now:new Date(at),timeZone:zone});
 assert.equal(resolve('P1M','2026-01-31T17:00:00Z'),'2026-02-28');
 assert.equal(resolve('P1M','2024-01-31T17:00:00Z'),'2024-02-29');
 assert.equal(resolve('P1Y','2024-02-29T17:00:00Z'),'2025-02-28');
 assert.equal(resolve('-P1M','2026-03-31T17:00:00Z'),'2026-02-28');
 assert.equal(resolve('P1M1D','2026-01-31T17:00:00Z'),'2026-03-01');
 assert.equal(resolve('P1D','2026-03-08T05:30:00Z'),'2026-03-09');
 assert.equal(resolve('P1D','2026-11-01T04:30:00Z'),'2026-11-02');
 assert.equal(resolve('P3M','2026-11-30T17:00:00Z'),'2027-02-28');
});
test('absolute dates, malformed values and time-only durations are not interpreted as relative calendar dates',()=>{
 for(const value of ['2026-09-06','P','-P','P1Q','P-1D','P1.5D','PT1H','P10001Y',null,{},['P1D']])assert.equal(resolveRelativeDate(value),undefined);
 assert.equal(resolveRelativeDate('P1D',{now:new Date(NaN),timeZone:'UTC'}),undefined);
 assert.equal(resolveRelativeDate('P10000Y',{now:new Date('2026-01-01Z'),timeZone:'UTC'}),undefined);
});
