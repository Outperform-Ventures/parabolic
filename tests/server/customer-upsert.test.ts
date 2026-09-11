import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {upsertCustomer,mergeCustomers} from '../../src/server/customers';
import type {Actor} from '../../src/server/repository';
import {ParabolicClient} from '../../packages/sdk/src/client';
async function fixture(){const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start(),setup=await app.auth.setup({name:'Customer API owner',email:'customer-api@example.test',password:'Customer-api-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};return {app,repo:app.repo,actor,url,cookie:`parabolic_session=${setup.token}`};}
test('documented GraphQL customer upsert merges normalized domains and external identifiers without replacing identity',async()=>{
 const f=await fixture();try{
  const call=async(query:string,input:object)=>{const response=await fetch(f.url+'/graphql',{method:'POST',headers:{cookie:f.cookie,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{input}})});assert.equal(response.status,200);const body=await response.json() as any;assert.equal(body.errors,undefined,JSON.stringify(body.errors));return body.data;};
  const created=await call('mutation($input:CustomerCreateInput!){customerCreate(input:$input){success customer{id name domains externalIds size revenue}}}',{name:'ACME',domains:['ACME.test','acme.test.'],externalIds:['source-123'],size:12,revenue:1250});
  const before=created.customerCreate.customer;assert.deepEqual(before.domains,['acme.test']);assert.equal(before.size,12);
  const query='mutation($input:CustomerUpsertInput!){customerUpsert(input:$input){success customer{id name domains externalIds size revenue}}}';
  const first=(await call(query,{domains:['acme.test','acme.dev'],externalId:'own-customer-id'})).customerUpsert;
  assert.equal(first.success,true);assert.equal(first.customer.id,before.id);assert.equal(first.customer.name,'ACME');assert.equal(first.customer.revenue,1250);assert.deepEqual(first.customer.domains,['acme.test','acme.dev']);assert.deepEqual(first.customer.externalIds,['source-123','own-customer-id']);
  const second=(await call(query,{externalId:'own-customer-id',domains:['acme.other'],size:14})).customerUpsert.customer;assert.equal(second.id,before.id);assert.equal(second.size,14);assert.deepEqual(second.domains,['acme.test','acme.dev','acme.other']);
  await call(query,{domains:['acme.test'],externalId:'own-customer-id'});assert.equal(f.repo.all('customers',f.actor.workspaceId).length,1);
  const fresh=(await call(query,{name:'Separate',domains:['separate.test'],externalId:'separate-123'})).customerUpsert.customer;assert.notEqual(fresh.id,before.id);assert.equal(fresh.name,'Separate');
  const sdk=new ParabolicClient({baseUrl:f.url,headers:{cookie:f.cookie}}),fromSdk=await sdk.customerUpsert({externalId:'own-customer-id',domains:['sdk.test'],size:20});
  assert.equal(fromSdk.customer.id,before.id);assert.equal(fromSdk.customer.workspaceId,f.actor.workspaceId);assert.equal(fromSdk.customer.size,20);assert.ok(fromSdk.customer.domains?.includes('sdk.test'));
 }finally{await f.app.close();}
});
test('customer identities reject collisions atomically and remain isolated by workspace and scope',async()=>{
 const f=await fixture();try{const {repo,actor}=f;
  const a=repo.create(actor,'customers',{name:'A',domain:'a.test',externalIds:['opaque-A']}),b=repo.create(actor,'customers',{name:'B',domains:['b.test','alias.test'],externalIds:['opaque-B']});
  const before=JSON.stringify(repo.all('customers',actor.workspaceId)),activity=repo.all('activities',actor.workspaceId).length;
  assert.throws(()=>upsertCustomer(repo,actor,{domains:['a.test','alias.test'],externalId:'new-id'}),/different customers/);
  assert.throws(()=>upsertCustomer(repo,actor,{domains:['a.test'],externalId:'opaque-B'}),/different customers/);
  assert.equal(JSON.stringify(repo.all('customers',actor.workspaceId)),before);assert.equal(repo.all('activities',actor.workspaceId).length,activity);
  assert.throws(()=>repo.create(actor,'customers',{name:'Duplicate secondary',domain:'ALIAS.test'}),/already exists/);
  assert.throws(()=>repo.update(actor,'customers',a.id,{externalIds:['opaque-B']}),/already exists/);
  assert.throws(()=>upsertCustomer(repo,{...actor,scopes:['customers:read']},{externalId:'opaque-A',name:'Not allowed'}),/scope/);
  const other={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Other workspace').workspaceId};const isolated=upsertCustomer(repo,other,{name:'Other A',domains:['a.test'],externalId:'opaque-A'});assert.notEqual(isolated.id,a.id);assert.equal(repo.get(actor,'customers',a.id).name,'A');
  repo.remove(actor,'customers',b.id);const replacement=upsertCustomer(repo,actor,{name:'Replacement',domains:['b.test'],externalId:'opaque-B'});assert.notEqual(replacement.id,b.id);assert.throws(()=>repo.restore(actor,'customers',b.id),/already exists/);
 }finally{await f.app.close();}
});
test('legacy primary-domain edits retain secondary identities and reject malformed identity arrays',async()=>{
 const f=await fixture();try{const {repo,actor}=f;const customer=repo.create(actor,'customers',{name:'Legacy',domain:'legacy.test'});
  const extended=upsertCustomer(repo,actor,{domains:['legacy.test','secondary.test'],externalId:'legacy-id'});
  const edited=repo.update(actor,'customers',customer.id,{...extended,domain:'new-primary.test'});assert.deepEqual(edited.domains,['new-primary.test','secondary.test']);
  const cleared=repo.update(actor,'customers',customer.id,{domain:''});assert.deepEqual(cleared.domains,['secondary.test']);assert.equal(cleared.domain,'secondary.test');
  for(const fields of [{domains:['']},{domains:'invalid'},{externalIds:[2]},{externalIds:[' ']},{domain:'one.test',domains:['two.test']}])assert.throws(()=>repo.create(actor,'customers',{name:'Invalid',...fields}));
  assert.throws(()=>upsertCustomer(repo,actor,{}),/required/);assert.throws(()=>upsertCustomer(repo,actor,{externalId:''}),/nonempty/);
 }finally{await f.app.close();}
});
test('customer merge preserves domain and external identity aliases for subsequent upserts',async()=>{
 const f=await fixture();try{const {repo,actor}=f;
  const source=repo.create(actor,'customers',{name:'Source',domains:['source.test','alias.test'],externalIds:['source-id']}),target=repo.create(actor,'customers',{name:'Target',domain:'target.test',externalIds:['target-id']});
  const merged=mergeCustomers(repo,actor,source.id,target.id);assert.equal(merged.domain,'target.test');assert.deepEqual(merged.domains,['target.test','source.test','alias.test']);assert.deepEqual(merged.externalIds,['target-id','source-id']);
  const reused=upsertCustomer(repo,actor,{externalId:'source-id',domains:['alias.test','new.test']});assert.equal(reused.id,target.id);assert.equal(reused.name,'Target');assert.equal(repo.all('customers',actor.workspaceId).length,1);
 }finally{await f.app.close();}
});
