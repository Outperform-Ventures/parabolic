import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleLocalDay,cycleInclusiveEnd,cycleExclusiveEnd} from '../../src/client/features/cycle-calendar';
test('cycle date controls roundtrip inclusive calendar days across positive zones, DST and midnight variants',()=>{
 assert.equal(cycleLocalDay('2026-09-05T10:01:00Z','Pacific/Kiritimati'),'2026-09-06');
 assert.equal(cycleInclusiveEnd('2026-03-16T04:01:00Z','America/New_York'),'2026-03-15');
 assert.equal(cycleInclusiveEnd('2026-03-16T04:00:00Z','America/New_York'),'2026-03-15');
 assert.equal(cycleExclusiveEnd('2028-02-29'),'2028-03-01');
 assert.equal(cycleExclusiveEnd('2026-12-31'),'2027-01-01');
});
