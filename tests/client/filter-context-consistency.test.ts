import test from 'node:test';import assert from 'node:assert/strict';
import {calculateInsight,defaultInsight,type InsightSource} from '../../src/client/features/insight-data';
import type {Entity} from '../../src/shared/types';
const e=(id:string,props:Record<string,unknown>={}):Entity=>({id,workspaceId:'w',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...props});
const issues=[e('a',{kind:'issues',title:'Alpha',projectId:'p',milestoneId:'m',assigneeId:'u'}),e('b',{kind:'issues',title:'Beta',assigneeId:'v'})];
const source:InsightSource={user:e('u'),issues,projects:[e('p',{leadId:'u'})],milestones:[e('m',{projectId:'p',name:'Launch'})],statuses:[],users:[],teams:[],labels:[],cycles:[],activities:[]};
const filter=(field:string,value:unknown,operator='eq')=>({match:'all' as const,conditions:[{field,operator,value}]});
test('Insights local and dashboard filters resolve viewer-relative choices and assigned milestones',()=>{
 for(const f of [filter('assigneeId','@current-user'),filter('projectLeadId','@current-user'),filter('milestoneName','LAUNCH','contains')]){
  assert.deepEqual(calculateInsight(source,{...defaultInsight,filters:f}).issues.map(i=>i.id),['a']);
  assert.deepEqual(calculateInsight(source,defaultInsight,f).issues.map(i=>i.id),['a']);
 }
 assert.deepEqual(calculateInsight({...source,user:e('v')},{...defaultInsight,filters:filter('assigneeId','@current-user')}).issues.map(i=>i.id),['b']);
 assert.equal(calculateInsight({...source,milestones:[]},{...defaultInsight,filters:filter('milestoneName','LAUNCH','contains')}).issues.length,0);
});
test('offline search uses the current index viewer and milestone context',async()=>{
 const messages:any[]=[];const worker={onmessage:null as any,postMessage:(message:any)=>messages.push(message)};(globalThis as any).self=worker;
 try{
  await import('../../src/client/search-worker');
  const index=(currentUserId:string)=>worker.onmessage({data:{type:'index',records:issues,projects:source.projects,milestones:source.milestones,currentUserId}});
  const search=(f:any)=>{worker.onmessage({data:{type:'search',id:1,query:'',kinds:['issues'],filter:f}});return messages.at(-1).nodes.map((i:any)=>i.id)};
  index('u');assert.deepEqual(search(filter('assigneeId','@current-user')),['a']);assert.deepEqual(search(filter('milestoneName','LAUNCH','contains')),['a']);
  index('v');assert.deepEqual(search(filter('assigneeId','@current-user')),['b']);
 }finally{delete (globalThis as any).self}
});
