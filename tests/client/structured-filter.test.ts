import test from'node:test';import assert from'node:assert/strict';
import{matchesFilter as client,expandLabelFilter,type FilterSpec}from'../../src/client/query';
import{matchesFilter as server}from'../../src/server/repository';import{resolveCalendarFilter}from'../../src/shared/relative-date-filter';
const records:any[]=[{id:'a',title:'Alpha delivery',priority:1,labelIds:['red'],archivedAt:null,createdAt:'2026-09-05T12:00:00.000Z',requests:[{tier:'enterprise'}]},{id:'b',title:'Beta delivery',priority:3,labelIds:['blue'],archivedAt:null,createdAt:'2026-09-06T11:00:00.000Z',requests:[]},{id:'c',title:'Alpha archived',priority:1,labelIds:['red','blue'],archivedAt:'2026-09-06T00:00:00.000Z',createdAt:'2026-09-06T11:00:00.000Z',requests:[]}];
const clock={now:new Date('2026-09-06T12:00:00Z'),timeZone:'UTC'};
test('client and API agree on nested structured logic, relative bounds and condition blocks',()=>{
 const filters=[{and:[{or:[{title:{startsWith:'Alpha'}},{conditions:[{field:'priority',operator:'eq',value:3}],match:'all'}]},{not:{archivedAt:{null:false}}},{createdAt:{gte:'-P1D'}}]},{requests:{some:{tier:{eq:'enterprise'}}}},{labelIds:{containsAll:['red','blue']}},{priority:{nin:[1]}},{or:[]}];
 const expected=[['a','b'],['a'],['c'],['b'],[]];
 for(const [index,filter]of filters.entries()){const resolved=resolveCalendarFilter(filter,clock);assert.deepEqual(records.filter(record=>server(record,resolved)).map(r=>r.id),expected[index]);assert.deepEqual(records.filter(record=>client(record,filter,undefined,undefined,undefined,clock)).map(r=>r.id),expected[index])}
});
test('expanded label conditions compose with nested API logic without changing their matches',()=>{
 const labels:any[]=[{id:'red',name:'Red'},{id:'blue',name:'Blue'}],filter:FilterSpec={match:'any',conditions:[{field:'labelIds',operator:'all',value:['red','blue']},{field:'priority',operator:'eq',value:3}]};
 const expanded=expandLabelFilter(filter,labels);assert.deepEqual(records.filter(record=>client(record,{and:[expanded,{archivedAt:{null:true}}]},labels)).map(r=>r.id),['b']);
 assert.equal(client(records[0],{not:{priority:{unsupported:1}}}),false);
});
