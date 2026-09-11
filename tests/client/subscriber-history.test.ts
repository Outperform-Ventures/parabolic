import test from 'node:test';import assert from 'node:assert/strict';
import {historyChange,inverseChange} from '../../src/client/mutation-history';import type {Entity} from '../../src/shared/types';

test('subscriber selection undo and redo replay the command and protect concurrent subscriber changes',()=>{
 const before:Entity={id:'issue',workspaceId:'workspace',createdAt:'2027-01-01',updatedAt:'2027-01-01',version:1,subscriberIds:['a'],subscriptionUserIds:['b'],subscribers:['a','b']};
 const change=historyChange('issues',before.id,'update',{subscribers:['a'],replaceSubscribers:true,version:1},before);
 assert.deepEqual(change.before,{subscribers:['a','b']});assert.deepEqual(change.after,{subscribers:['a']});
 const after={...before,subscribers:['a'],subscriptionUserIds:[],version:2};
 assert.deepEqual(inverseChange(change,'undo',after),{action:'update',data:{subscribers:['a','b'],replaceSubscribers:true}});
 assert.deepEqual(inverseChange(change,'redo',before),{action:'update',data:{subscribers:['a'],replaceSubscribers:true}});
 assert.throws(()=>inverseChange(change,'undo',{...after,subscribers:['a','c']}),/changed after/);
});

test('conflict resolution rebases the overwritten history side without mutating old history',async()=>{
 const {rebaseHistoryChange}=await import('../../src/client/mutation-history');
 const original:Entity={id:'issue',workspaceId:'workspace',createdAt:'2027-01-01',updatedAt:'2027-01-01',version:1,subscribers:['a']};
 const change=historyChange('issues',original.id,'update',{subscribers:[],replaceSubscribers:true},original),remote={...original,version:2,subscribers:['a','b']};
 const edit=rebaseHistoryChange(change,remote,'before');assert.deepEqual(inverseChange(edit,'undo',{...remote,subscribers:[]}).data,{subscribers:['a','b'],replaceSubscribers:true});assert.deepEqual(change.before,{subscribers:['a']});
 const undo=rebaseHistoryChange(change,remote,'after');assert.deepEqual(inverseChange(undo,'redo',original).data,{subscribers:['a','b'],replaceSubscribers:true});assert.deepEqual(change.after,{subscribers:[]});
});
