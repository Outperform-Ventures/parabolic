import test from 'node:test';import assert from 'node:assert/strict';import {matchesFilter,expandLabelFilter} from '../../src/client/query';import {matchesFilter as serverMatches} from '../../src/server/repository';import {toggleFilterSelection} from '../../src/client/issue-filter-selection';
test('label modes agree locally and on the server, including hierarchical exclude-all',()=>{
const labels=[{id:'group',name:'Kind',isGroup:true},{id:'a',name:'Alpha',labelGroupId:'group'},{id:'b',name:'Beta'}] as any;
for(const operator of ['all','in','none','notAll'])for(const labelIds of [[],['a'],['b'],['a','b']]){const filter={match:'all' as const,conditions:[{field:'labelIds',operator,value:['group','b']}]},entity={id:'i',labelIds} as any;assert.equal(matchesFilter(entity,filter,labels),serverMatches(entity,expandLabelFilter(filter,labels)),operator+':'+labelIds);}
assert.equal(matchesFilter({id:'i',labelIds:[]} as any,{conditions:[{field:'labelIds',operator:'notAll',value:['a','b']}]}),true);
});
test('label selection defaults to all and keeps No labels exclusive',()=>{
let f=toggleFilterSelection({match:'all',conditions:[]},'labelIds',null);f=toggleFilterSelection(f,'labelIds','a');assert.deepEqual(f.conditions,[{field:'labelIds',operator:'all',value:['a']}]);f=toggleFilterSelection(f,'labelIds','b');assert.equal(f.conditions[0].operator,'all');f=toggleFilterSelection(f,'labelIds',null);assert.deepEqual(f.conditions[0].value,[null]);f={...f,conditions:[{field:'labelIds',operator:'notAll',value:['a']}]};f=toggleFilterSelection(f,'labelIds','b');assert.equal(f.conditions[0].operator,'notAll');
});
