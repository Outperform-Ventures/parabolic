import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeDate} from '../../src/client/query';

test('relative hours and days match captured native activity labels',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-09-08T19:25:38.793Z'));
 assert.equal(relativeDate('2026-09-08T03:54:58.000Z'),'16h ago');
 assert.equal(relativeDate('2026-09-05T21:51:32.589Z'),'3d ago');
});
