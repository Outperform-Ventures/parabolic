import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reorderIssueSelection,issueSelectionRange} from '../../src/client/issue-selection-order';
test('range selection preserves existing selection, follows visible order, and tolerates a filtered anchor',()=>{
 const items='abcde'.split('').map(id=>({id}));
 assert.deepEqual(issueSelectionRange(items,['a'],'b','d'),['a','b','c','d']);
 assert.deepEqual(issueSelectionRange(items,[],'d','b'),['b','c','d']);
 assert.deepEqual(issueSelectionRange(items,[],'hidden','c'),['c']);
 assert.deepEqual(issueSelectionRange(items,['a'],'b','hidden'),['a']);
});
test('keyboard reordering moves contiguous and disjoint selections without reversing order or wrapping edges',()=>{
 const items='abcdef'.split('').map(id=>({id}));
 const order=(selection:string,direction:string)=>reorderIssueSelection(items,new Set(selection),direction).map(i=>i.id).join('');
 assert.equal(order('bc','up'),'bcadef');assert.equal(order('bd','up'),'badcef');
 assert.equal(order('bc','down'),'adbcef');assert.equal(order('bd','down'),'acbedf');
 assert.equal(order('ac','top'),'acbdef');assert.equal(order('ac','bottom'),'bdefac');
 assert.equal(order('ab','up'),'abcdef');assert.equal(order('ef','down'),'abcdef');
 assert.equal(items.map(i=>i.id).join(''),'abcdef');
});
