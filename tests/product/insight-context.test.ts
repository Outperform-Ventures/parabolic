import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInsightContext} from '../../src/client/insight-context.ts';
import {matchesFilter} from '../../src/client/query.ts';

test('shared insight context validates every condition and safely rejects malformed or unbounded links',()=>{
  const wrap=(conditions:any[],extra:Record<string,any>={})=>JSON.stringify({filter:{conditions,match:'all'},...extra});
  for(const condition of [null,1,'priority',[],{}, {field:null,operator:'eq',value:1},{field:'priority',operator:'unknown',value:1},{field:'priority',operator:'in',value:3},{field:'priority',operator:'in',value:[{bad:true}]},{field:'priority',operator:'gte',value:true},{field:'constructor.name',operator:'eq',value:'x'},{field:'__proto__.hidden',operator:'eq',value:true},{field:'priority',operator:'eq',value:{bad:true}},{field:'priority',operator:'eq',value:'x'.repeat(2001)}])assert.equal(parseInsightContext(wrap([condition])),null,JSON.stringify(condition));
  for(const value of [null,'','{','[]','null',wrap(Array(101).fill({field:'priority',operator:'eq',value:1})),wrap([],{query:'x'.repeat(1001)}),wrap([],{showCompleted:'false'}),JSON.stringify({filter:{conditions:[],match:'sometimes'}}),' '.repeat(65537)])assert.equal(parseInsightContext(value),null);
  const accepted=parseInsightContext(wrap([{field:'priority',operator:'in',value:[1,2]},{field:'estimate',operator:'gte',value:0},{field:'parentId',operator:'empty'}],{query:'Readable',showCompleted:false,showSubIssues:false}))!;assert.equal(matchesFilter({id:'issue',workspaceId:'w',version:1,createdAt:'',updatedAt:'',priority:1,estimate:3},accepted.filter),true);assert.equal(accepted.query,'Readable');assert.equal(accepted.showCompleted,false);assert.equal(accepted.showSubIssues,false);assert.deepEqual(accepted.filter.conditions[2],{field:'parentId',operator:'empty',value:null});assert.deepEqual(parseInsightContext(wrap([])),{filter:{conditions:[],match:'all'},query:'',showCompleted:true,showSubIssues:true});
});
