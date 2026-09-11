import test from 'node:test';import assert from 'node:assert/strict';import {matchesFilter,expandLabelFilter} from '../../src/client/query';
test('No labels supports union, exclusion and leaves empty operators unchanged',()=>{
 const empty={id:'a',labelIds:[]} as any,used={id:'b',labelIds:['l']} as any,other={id:'c',labelIds:['other']} as any;
 const f=(operator:string,value:any)=>({match:'all' as const,conditions:[{field:'labelIds',operator,value}]});
 for(const labels of [undefined,[]]){assert.equal(matchesFilter(empty,f('in',[null]),labels),true);assert.equal(matchesFilter(used,f('in',[null]),labels),false);assert.equal(matchesFilter(empty,f('none',[null,'l']),labels),false);assert.equal(matchesFilter(used,f('none',[null,'l']),labels),false);assert.equal(matchesFilter(other,f('none',[null,'l']),labels),true);assert.equal(matchesFilter(empty,f('empty',''),labels),true);assert.equal(matchesFilter(empty,f('notEmpty',''),labels),false);}
 assert.equal(matchesFilter(empty,f('in',[null,'l']),[]),true);assert.equal(matchesFilter(used,f('in',[null,'l']),[]),true);assert.equal(matchesFilter(other,f('in',[null,'l']),[]),false);
 assert.deepEqual(expandLabelFilter(f('in',[null,'l']),[]),{and:[{conditions:[{field:'labelIds',operator:'empty',value:null},{field:'labelIds',operator:'eq',value:'l'}],match:'any'}]});
});
