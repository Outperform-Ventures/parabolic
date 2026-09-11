import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTabs,staleTabIds,tabCleanupDuration,issueTabHasJournal} from '../../src/client/tab-cleanup.ts';

test('Stale tabs use the observed production intervals and protect active, pinned, and unsaved work',()=>{
  const now=100000000,old=now-6*3600000,tabs=[{id:'active',route:'/projects',lastActiveAt:old},{id:'stale',route:'/search',lastActiveAt:old},{id:'pinned',route:'/documents',lastActiveAt:old,pinned:true},{id:'draft',route:'/issues/one',lastActiveAt:old},{id:'recent',route:'/inbox',lastActiveAt:old+1}];
  assert.deepEqual(staleTabIds(tabs,'active','sixHours',now,tab=>tab.id==='draft'),['stale']);
  assert.deepEqual(staleTabIds(tabs,'active','never',now),[]);
  for(const value of [null,undefined,'oneMinute','invalid'])assert.equal(tabCleanupDuration(value),null);
  assert.equal(tabCleanupDuration('sevenDays'),7*86400000);
  assert.deepEqual(staleTabIds(tabs,'active','sixHours',old-1),[],'A clock moved backward cannot age out tabs');
});
test('Persisted tab migration is safe, scoped storage journals protect edits, and missing activity starts fresh',()=>{
  const now=123456,rows=normalizeTabs([{id:'a',route:'/projects'},{id:'a',route:'/inbox'},{id:'bad',route:'//foreign.test'},{id:'b',route:'/search',lastActiveAt:999999}],'/my-issues',now);
  assert.deepEqual(rows.map(row=>[row.id,row.lastActiveAt]),[['a',now],['b',now]]);
  assert.equal(normalizeTabs(null,'/inbox',now)[0].route,'/inbox');
  const reads:string[]=[];const storage={getItem(key:string){reads.push(key);return '{"title":"Unsaved title"}';}};
  assert.equal(issueTabHasJournal({id:'issue',route:'/issues/one?focus=comments',lastActiveAt:now},'person',storage),true);assert.deepEqual(reads,['issue-edit:person:one']);
  assert.equal(issueTabHasJournal(rows[0],'person',storage),false);assert.equal(issueTabHasJournal({id:'issue',route:'/issues/one',lastActiveAt:now},'person',{getItem:()=>'{'}),true);
});
