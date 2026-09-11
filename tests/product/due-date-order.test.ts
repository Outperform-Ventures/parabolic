import test from 'node:test';import assert from 'node:assert/strict';import {sortEntities} from '../../src/client/query';import type {Entity} from '../../src/shared/types';
test('due dates sort ahead of missing dates in either direction without mutating source order',()=>{
 const rows=[{id:'none',dueDate:null},{id:'late',dueDate:'2026-12-31'},{id:'empty',dueDate:''},{id:'early',dueDate:'2026-01-01'},{id:'absent'}] as Entity[];
 assert.deepEqual(sortEntities(rows,'dueDate','asc').map(r=>r.id),['early','late','none','empty','absent']);
 assert.deepEqual(sortEntities(rows,'dueDate','desc').map(r=>r.id),['late','early','none','empty','absent']);
 assert.deepEqual(rows.map(r=>r.id),['none','late','empty','early','absent']);
});
