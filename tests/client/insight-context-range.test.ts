import test from'node:test';import assert from'node:assert/strict';import{parseInsightContext}from'../../src/client/insight-context';
const parse=(condition:any)=>parseInsightContext(JSON.stringify({filter:{conditions:[condition],match:'all'},query:'retained'}));
test('Insights links preserve calendar ranges and multi-label all/none choices',()=>{
 for(const operator of ['within','before','after'])for(const value of [['2026-09-05','2026-09-07'],['P0D','P1W']]){const c={field:'dueDate',operator,value};assert.deepEqual(parse(c)?.filter.conditions,[c]);assert.equal(parse(c)?.query,'retained')}
 for(const operator of ['all','none']){const c={field:'labelIds',operator,value:['group','label']};assert.deepEqual(parse(c)?.filter.conditions,[c])}
});
test('Insights links reject malformed or inverted ranges without weakening other array validation',()=>{
 for(const value of [[],['2026-09-05'],['2026-09-07','2026-09-05'],['2026-02-30','2026-03-05'],['P','P1W'],['2026-09-05',{}],'2026-09-05'])assert.equal(parse({field:'dueDate',operator:'within',value}),null);
 assert.equal(parse({field:'title',operator:'within',value:['a','b']}),null);assert.equal(parse({field:'labelIds',operator:'none',value:[{}]}),null);
});
test('on-date links accept only valid calendar operands on date properties',()=>{
 for(const field of ['dueDate','createdAt','targetDate']){const c={field,operator:'on',value:'2026-11-01'};assert.deepEqual(parse(c)?.filter.conditions,[c])}
 for(const value of ['P1D','2026-02-30','',null,['2026-11-01','2026-11-02']])assert.equal(parse({field:'createdAt',operator:'on',value}),null);
 assert.equal(parse({field:'title',operator:'on',value:'2026-11-01'}),null);
});
