import test from'node:test';import assert from'node:assert/strict';
import{customerRequestRecipients}from'../src/server/customers';
const old={id:'request',customerId:'customer',issueId:'issue',important:false,status:'Open'};
function recipients(events:string[],next:any,previous:any=old){const result:string[]=[];const repo={raw:()=>null,all:()=>[{userId:'customer-watcher',customerId:'customer',customerEvents:events},{userId:'issue-watcher',issueId:'issue'}]};customerRequestRecipients(repo as any,{workspaceId:'workspace'} as any,next,previous,(id)=>result.push(id));return result;}
test('customer subscriptions filter each event without muting separate issue subscriptions',()=>{
 assert.deepEqual(recipients([], {...old,important:true}),['issue-watcher']);
 assert.deepEqual(recipients(['request-important'], {...old,important:true}),['customer-watcher','issue-watcher']);
 assert.deepEqual(recipients(['request-added'], {...old,important:true}),['issue-watcher']);
 assert.deepEqual(recipients(['request-completed'], {...old,status:'Completed'}),['customer-watcher','issue-watcher']);
 assert.deepEqual(recipients(['request-completed'], {...old,status:'Canceled'}),['customer-watcher','issue-watcher']);
 assert.deepEqual(recipients(['request-important'], {...old,status:'Completed'}),['issue-watcher']);
 assert.deepEqual(recipients(['request-added'],old,undefined),[]);
});
test('new requests and customer moves use request-added choice',()=>{
 const result:string[]=[];const repo={raw:()=>null,all:()=>[{userId:'watcher',customerId:'customer',customerEvents:['request-added']}]};
 customerRequestRecipients(repo as any,{workspaceId:'workspace'} as any,old as any,undefined,id=>result.push(id));assert.deepEqual(result,['watcher']);
 assert.deepEqual(recipients(['request-added'],old,{...old,customerId:'other'}),['customer-watcher','issue-watcher']);
});
