import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortIssuesByRules} from '../../src/client/issue-sort-rules';
const records={statuses:[],users:[],projects:[],teams:[]};
test('custom numbers, duration and assignee counts use field values rather than strings',()=>{
 const rows=[{id:'a',customFields:{score:{value:10}},startDate:'2026-09-01',dueDate:'2026-09-03',assigneeIds:['a']},{id:'b',customFields:{score:{value:2}},startDate:'2026-09-01',dueDate:'2026-09-05',assigneeIds:['a','b']}] as any;
 assert.deepEqual(sortIssuesByRules(rows,[{field:'customFields.score',direction:'asc'}],records).map(i=>i.id),['b','a']);
 assert.deepEqual(sortIssuesByRules(rows,[{field:'duration',direction:'desc'}],records).map(i=>i.id),['b','a']);
 assert.deepEqual(sortIssuesByRules(rows,[{field:'assigneeId',direction:'asc'}],records).map(i=>i.id),['b','a']);
});
test('four rules break ties in order, without priority manual positions swallowing later rules',()=>{
 const rows=[{id:'a',priority:2,dueDate:'2026-10-01',estimate:2,title:'Z',prioritySortOrder:0},{id:'b',priority:2,dueDate:'2026-09-01',estimate:2,title:'Z',prioritySortOrder:10},{id:'c',priority:2,dueDate:'2026-09-01',estimate:4,title:'Z'},{id:'d',priority:2,dueDate:'2026-09-01',estimate:4,title:'A'},{id:'e',priority:1}] as any;
 const rules=[{field:'priority',direction:'asc'},{field:'dueDate',direction:'asc'},{field:'estimate',direction:'desc'},{field:'title',direction:'asc'}] as const;
 assert.deepEqual(sortIssuesByRules(rows,[...rules],records).map(i=>i.id),['e','d','c','b','a']);
 assert.deepEqual(rows.map((i:any)=>i.id),['a','b','c','d','e']);
});
test('empty fields remain last for both directions and complete ties remain stable',()=>{
 const rows=[{id:'a',estimate:0},{id:'b'},{id:'c',estimate:2},{id:'d',estimate:2}] as any;
 assert.deepEqual(sortIssuesByRules(rows,[{field:'estimate',direction:'desc'}],records).map(i=>i.id),['c','d','a','b']);
 assert.deepEqual(sortIssuesByRules(rows,[{field:'estimate',direction:'asc'}],records).map(i=>i.id),['a','c','d','b']);
});
