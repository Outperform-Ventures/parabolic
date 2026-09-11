import test from'node:test';import assert from'node:assert/strict';import{resolveRelativeTimestamp}from'../../src/shared/relative-timestamp-filter';
const at=(value:string,now:string,timeZone='America/New_York')=>resolveRelativeTimestamp(value,{now:new Date(now),timeZone});
test('relative timestamp days retain wall time while hours measure elapsed time across DST',()=>{
 assert.equal(at('P1D','2026-03-07T17:15:30.123Z'),'2026-03-08T16:15:30.123Z');
 assert.equal(at('PT24H','2026-03-07T17:15:30.123Z'),'2026-03-08T17:15:30.123Z');
 assert.equal(at('-P1D','2026-03-08T16:15:30.123Z'),'2026-03-07T17:15:30.123Z');
 assert.equal(at('P1D','2026-10-31T16:15:30.123Z'),'2026-11-01T17:15:30.123Z');
 assert.equal(at('PT24H','2026-10-31T16:15:30.123Z'),'2026-11-01T16:15:30.123Z');
});
test('calendar shifts move nonexistent local times forward and select the earlier repeated time',()=>{
 assert.equal(at('P1D','2026-03-07T07:30:00.000Z'),'2026-03-08T07:30:00.000Z');
 assert.equal(at('P1D','2026-10-31T05:30:00.000Z'),'2026-11-01T05:30:00.000Z');
 assert.equal(at('P1D','2026-10-24T00:30:00.000Z','Europe/Berlin'),'2026-10-25T00:30:00.000Z');
 assert.equal(at('P0D','2026-11-01T06:30:00.000Z'),'2026-11-01T06:30:00.000Z');
 assert.equal(at('PT1H','2026-11-01T06:30:00.000Z'),'2026-11-01T07:30:00.000Z');
});
test('month/year clamps and compound calendar units retain intermediate DST adjustments',()=>{
 assert.equal(at('P1M','2024-01-31T17:45:00.500Z'),'2024-02-29T17:45:00.500Z');
 assert.equal(at('P1Y','2024-02-29T17:45:00.500Z'),'2025-02-28T17:45:00.500Z');
 assert.equal(at('-P1M','2026-03-31T16:45:00.500Z'),'2026-02-28T17:45:00.500Z');
 assert.equal(at('P1M1D','2026-02-08T07:30:00.000Z'),'2026-03-09T07:30:00.000Z');
 assert.equal(at('P1DT2H30M','2026-03-07T17:00:00.000Z'),'2026-03-08T18:30:00.000Z');
});
test('explicit non-DST zones retain subsecond precision and do not mutate the clock',()=>{
 const now=new Date('2026-09-06T23:59:59.987Z');assert.equal(resolveRelativeTimestamp('-PT1S',{now,timeZone:'Asia/Kathmandu'}),'2026-09-06T23:59:58.987Z');assert.equal(now.toISOString(),'2026-09-06T23:59:59.987Z');
 assert.equal(at('P1W','2026-09-06T23:59:59.987Z','Asia/Tokyo'),'2026-09-13T23:59:59.987Z');
});
test('invalid, unsupported fractional or out-of-range durations remain unresolved',()=>{
 for(const value of [null,{},'P','PT','P1DT','PT1.5H','P-1D','2026-09-06','P10001Y','P10000Y'])assert.equal(resolveRelativeTimestamp(value,{now:new Date('2026-01-01T00:00:00Z'),timeZone:'UTC'}),undefined);
});
