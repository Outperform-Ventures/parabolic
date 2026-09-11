import test from 'node:test';import assert from 'node:assert/strict';
import {matchesFilter,expandLabelFilter,type FilterSpec} from '../../src/client/query';
import {matchesFilter as server} from '../../src/server/repository';
import {expandFilterGroups,filterConditionCount} from '../../src/shared/filter-groups';
import {parseRouteFilter} from '../../src/client/route-filter';
import {hasRelativeTimestampFilter,resolveCalendarFilter} from '../../src/shared/relative-date-filter';
const leaf=(field:string,value:any)=>({field,operator:'eq',value});
test('grouped UI filters retain boolean boundaries through URLs and client/API evaluation',()=>{
 const filter:FilterSpec={conditions:[leaf('teamId','a')],match:'all',groups:[{conditions:[leaf('priority',1),leaf('priority',2)],match:'any',groups:[{conditions:[leaf('title','Third'),leaf('priority',3)],match:'all'}]},{conditions:[],match:'any'}]};
 const before=JSON.stringify(filter);assert.deepEqual(parseRouteFilter(before),filter);assert.equal(filterConditionCount(filter),5);
 const records:any[]=[{teamId:'a',priority:1},{teamId:'a',priority:2},{teamId:'a',priority:3,title:'Third'},{teamId:'b',priority:1},{teamId:'a',priority:3,title:'Other'}];
 for(const [i,record]of records.entries()){assert.equal(matchesFilter(record,filter),i<3);assert.equal(server(record,expandFilterGroups(filter)),i<3)}
 assert.equal(JSON.stringify(filter),before);
});
test('group-only label and moving date filters preserve resolution and empty editor state',()=>{
 const filter:FilterSpec={conditions:[],match:'all',groups:[{conditions:[{field:'labelIds',operator:'all',value:['colors']},{field:'updatedAt',operator:'gte',value:'-PT1H'}],match:'all'}]};
 const clock={now:new Date('2026-09-06T12:00:00Z'),timeZone:'UTC'},labels:any[]=[{id:'colors',name:'Colors',isGroup:true},{id:'red',name:'Red',labelGroupId:'colors'}];
 assert.equal(hasRelativeTimestampFilter(filter),true);
 const resolved=resolveCalendarFilter(expandLabelFilter(filter,labels),clock);
 for(const [date,expected]of [['2026-09-06T11:30:00.000Z',true],['2026-09-06T10:30:00.000Z',false]] as const){const record:any={labelIds:['red'],updatedAt:date};assert.equal(matchesFilter(record,filter,labels,undefined,undefined,clock),expected);assert.equal(server(record,resolved),expected)}
 const empty={conditions:[],match:'any',groups:[{conditions:[],match:'all'}]};assert.deepEqual(parseRouteFilter(JSON.stringify(empty)),empty);assert.equal(matchesFilter({} as any,empty),true);
});
test('malformed or excessively nested groups reject the entire shared filter',()=>{
 for(const groups of [null,{},[null],[{conditions:[leaf('constructor','bad')]}],[{conditions:[],match:'invalid'}]])assert.equal(parseRouteFilter(JSON.stringify({conditions:[],groups})),null);
 let filter:any={conditions:[leaf('title','deep')],match:'all'};for(let i=0;i<17;i++)filter={conditions:[],match:'all',groups:[filter]};assert.equal(parseRouteFilter(JSON.stringify(filter)),null);
 assert.throws(()=>expandFilterGroups({groups:[]}));assert.equal(matchesFilter({} as any, {groups:[]}),false);
});
