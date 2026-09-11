import test from 'node:test';import assert from 'node:assert/strict';import type {Entity} from '../../src/shared/types';import {commonSubscribers,subscriberSelectionChanges} from '../../src/client/subscriber-selection';
const issue=(id:string,subscribers:string[]):Entity=>({id,workspaceId:'workspace',createdAt:'2027-01-01',updatedAt:'2027-01-01',version:1,subscribers});
test('bulk subscriber edits preserve distinct untouched lists and emit only changed issues',()=>{
 const a=issue('a',['common','only-a']),b=issue('b',['common','only-b']);
 assert.deepEqual(commonSubscribers([a,b]),['common']);assert.deepEqual(subscriberSelectionChanges([a,b],['common'],[]),[]);
 const changes=subscriberSelectionChanges([a,b],['new'],['common','new']);
 assert.equal(changes[0].expectedVersion,a.version);assert.deepEqual(changes[0].expectedFields,{subscribers:['common','only-a']});
 assert.deepEqual(changes.map(c=>c.data.subscribers),[['new','only-a'],['new','only-b']]);
 assert.deepEqual(subscriberSelectionChanges([a,b],['common'],['only-a']).map(c=>[c.id,c.data.subscribers]),[['a',['common']]]);
 const changedWhileOpen=issue('a',['common','only-a','remote']);assert.deepEqual(subscriberSelectionChanges([changedWhileOpen],[],['common'])[0].data.subscribers,['only-a','remote']);
});
