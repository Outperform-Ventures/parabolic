import test from'node:test';import assert from'node:assert/strict';import{parseRouteFilter}from'../../src/client/route-filter';
test('temporary filter URLs preserve explicit clearing and duration/range intent',()=>{
 for(const filter of [{conditions:[],match:'all'},{conditions:[{field:'createdAt',operator:'on',value:'2026-11-01'}],match:'any'},{conditions:[{field:'updatedAt',operator:'gte',value:'-P1D'},{field:'labelIds',operator:'all',value:['group','label']}],match:'all'}])assert.deepEqual(parseRouteFilter(JSON.stringify(filter)),filter);
});
test('temporary filter URLs reject malformed and unsafe conditions as a whole',()=>{
 for(const raw of [null,'null','[]','invalid','x'.repeat(65537),JSON.stringify({conditions:[null]}),JSON.stringify({conditions:[{field:'constructor.prototype.polluted',operator:'eq',value:true}]}),JSON.stringify({conditions:[{field:'title',operator:'within',value:['a','b']}]}),JSON.stringify({conditions:[{field:'dueDate',operator:'on',value:'2026-02-30'}]})])assert.equal(parseRouteFilter(raw),null);
 assert.equal(({} as any).polluted,undefined);
});
