import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {initializeCustomerTiers} from '../../src/server/customer-tiers';
import type {Actor} from '../../src/server/repository';
import {ParabolicClient} from '../../packages/sdk/src/client';
import {buildSchema,isObjectType,isInputObjectType,type GraphQLArgument,type GraphQLField} from 'graphql';
import {readFile} from 'node:fs/promises';
import {buildApiSchema} from '../../src/server/graphql';
import {existsSync} from 'node:fs';
const schemaFixture='reference/parabolic-api/schema.graphql';
async function fixture(){const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start(),setup=await app.auth.setup({name:'Tier owner',email:'tier@example.test',password:'Customer-tier-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};return {app,repo:app.repo,actor,sdk:new ParabolicClient({baseUrl:url,headers:{cookie:`parabolic_session=${setup.token}`}})};}
test('customer tier API and SDK preserve identity across assignment, rename, reorder and guarded deletion',async()=>{
 const f=await fixture();try{const {repo,actor,sdk}=f;assert.equal(repo.all('customerTiers',actor.workspaceId).length,4);
  const created=await sdk.customerTierCreate({displayName:'Strategic',color:'#123456',description:'Highest customer tier',position:1});assert.equal(created.success,true);assert.ok(created.lastSyncId>0);const tier=created.tier;assert.equal(tier.name,'Strategic');assert.equal(tier.position,5);
  const customer=await sdk.customerUpsert({name:'Tier customer',domains:['tier.test'],tierId:tier.id});assert.equal(repo.raw('customers',customer.customer.id)!.tierId,tier.id);
  const read=await sdk.graphql<any>('query($id:String!){customer(id:$id){id tierId tier{id name displayName color}}}',{id:customer.customer.id});assert.equal(read.customer.tier.id,tier.id);assert.equal(read.customer.tierId,tier.id);
  const renamed=await sdk.customerTierUpdate(tier.id,{name:'strategic-internal',displayName:'Priority partner',position:1});assert.equal(renamed.tier.id,tier.id);assert.equal(renamed.tier.position,1);assert.equal(repo.raw('customers',customer.customer.id)!.tier,'Priority partner');assert.equal(new Set(repo.all('customerTiers',actor.workspaceId).map(t=>t.position)).size,5);
  await assert.rejects(()=>sdk.customerTierDelete(tier.id),/still in use/);repo.update(actor,'customers',customer.customer.id,{tierId:null});assert.equal(repo.raw('customers',customer.customer.id)!.tier,'');assert.equal((await sdk.customerTierDelete(tier.id)).success,true);assert.equal(repo.raw('customerTiers',tier.id),null);
 }finally{await f.app.close();}
});
test('tier validation enforces scoped writes, workspace identity, names and rollback',async()=>{
 const f=await fixture();try{const {repo,actor}=f;const create=(fields:any)=>repo.create(actor,'customerTiers',fields),count=()=>repo.all('customerTiers',actor.workspaceId).length;
  for(const fields of [{name:'Invalid',color:'red'},{name:'',color:'#112233'},{name:'Invalid',color:'#112233',position:Infinity},{name:'Enterprise',color:'#112233'}])assert.throws(()=>create(fields));assert.equal(count(),4);
  assert.throws(()=>repo.create({...actor,scopes:['read']},'customerTiers',{name:'Denied',color:'#112233'}),/scope/);
  const other={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Other tier workspace').workspaceId},foreign=repo.all('customerTiers',other.workspaceId)[0];assert.throws(()=>repo.create(actor,'customers',{name:'Wrong tier',tierId:foreign.id}),/not available/);
  const before=JSON.stringify(repo.all('customerTiers',actor.workspaceId));assert.throws(()=>repo.transaction(()=>{create({name:'Rollback',color:'#112233'});throw new Error('Abort whole transaction')}),/Abort/);assert.equal(JSON.stringify(repo.all('customerTiers',actor.workspaceId)),before);
  const customer=repo.create(actor,'customers',{name:'Legacy field',tier:'Enterprise'}),growth=repo.all('customerTiers',actor.workspaceId).find(t=>t.name==='Growth')!;const changed=repo.update(actor,'customers',customer.id,{...customer,tier:'Growth'});assert.equal(changed.tierId,growth.id);
 }finally{await f.app.close();}
});
test('legacy customer tier names migrate to stable records once without losing customer associations',async()=>{
 const f=await fixture();try{const {repo,actor}=f,customer=repo.create(actor,'customers',{name:'Legacy',tier:'Enterprise'});
  repo.db.prepare("DELETE FROM entities WHERE kind='customerTiers' AND workspace_id=?").run(actor.workspaceId);repo.db.prepare("UPDATE entities SET data=json_remove(data,'$.tierId') WHERE kind='customers' AND id=?").run(customer.id);repo.db.prepare('DELETE FROM data_migrations WHERE name=?').run('customer-tier-entities-v1');initializeCustomerTiers(repo);
  const migrated=repo.raw('customers',customer.id)!;assert.ok(migrated.tierId);assert.equal(repo.raw('customerTiers',migrated.tierId)!.displayName,'Enterprise');const tiers=JSON.stringify(repo.all('customerTiers',actor.workspaceId));initializeCustomerTiers(repo);assert.equal(JSON.stringify(repo.all('customerTiers',actor.workspaceId)),tiers);
 }finally{await f.app.close();}
});
test('tier SDK pagination handles direction, ordering, archived resources and scoped cursors',async()=>{
 const f=await fixture();try{const {repo,actor,sdk}=f;
  const tiers=['A','B','C'].map((name,index)=>repo.create({...actor,now:new Date(`2030-01-0${index+1}T00:00:00Z`)},'customerTiers',{name,color:'#123456'}));
  assert.equal((await sdk.customerTier(tiers[0].id)).name,'A');const first=await sdk.customerTiers({first:2});assert.deepEqual(first.nodes.map(t=>t.name),['C','B']);assert.equal(first.totalCount,7);assert.equal(first.nodes[0].workspaceId,actor.workspaceId);assert.equal(first.nodes[0].version,1);assert.equal(first.pageInfo.hasNextPage,true);assert.equal(first.edges[1].cursor,first.pageInfo.endCursor);
  const second=await sdk.customerTiers({first:1,after:first.pageInfo.endCursor!});assert.deepEqual(second.nodes.map(t=>t.name),['A']);assert.equal(second.pageInfo.hasPreviousPage,true);
  const backward=await sdk.customerTiers({last:1,before:second.pageInfo.startCursor!});assert.deepEqual(backward.nodes.map(t=>t.name),['B']);
  const ids:string[]=[];let after:string|undefined;do{const page=await sdk.customerTiers({first:2,after});ids.push(...page.nodes.map(t=>t.id));after=page.pageInfo.hasNextPage?page.pageInfo.endCursor!:undefined;}while(after);assert.equal(ids.length,7);assert.equal(new Set(ids).size,7);
  repo.update({...actor,now:new Date('2031-01-01T00:00:00Z')},'customerTiers',tiers[0].id,{description:'Recently updated'});assert.equal((await sdk.customerTiers({first:1,orderBy:'updatedAt'})).nodes[0].id,tiers[0].id);
  repo.update(actor,'customerTiers',tiers[2].id,{archivedAt:new Date().toISOString()});assert.equal((await sdk.customerTiers()).totalCount,6);assert.equal((await sdk.customerTiers({includeArchived:true})).totalCount,7);assert.equal((await sdk.customerTiers({first:0})).nodes.length,0);
  await assert.rejects(()=>sdk.customerTiers({first:1,last:1}),/either first or last/);await assert.rejects(()=>sdk.customerTiers({after:'malformed'}),/cursor/i);
  const other={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign cursor').workspaceId},foreign=repo.list(other,'customerTiers',{first:1});await assert.rejects(()=>sdk.customerTiers({after:foreign.pageInfo.endCursor!}),/different collection/);
  const deletion=await sdk.customerTierDelete(tiers[1].id);assert.equal(deletion.entityId,tiers[1].id);assert.equal(deletion.success,true);assert.equal(deletion.lastSyncId,Number((repo.db.prepare('SELECT MAX(seq) AS id FROM changes WHERE workspace_id=?').get(actor.workspaceId) as any).id));await assert.rejects(()=>sdk.customerTier(tiers[1].id),/not found/);
 }finally{await f.app.close();}
});
test('retained tier fields and root operation signatures match the pinned official schema',{skip:!existsSync(schemaFixture)},async()=>{
 const f=await fixture();try{
  const upstream=buildSchema(await readFile(schemaFixture,'utf8')),local=buildApiSchema(f.repo);
  for(const name of ['CustomerTier','CustomerTierCreateInput','CustomerTierUpdateInput','CustomerTierPayload','CustomerTierConnection','CustomerTierEdge','DeletePayload']){
   const expected=upstream.getType(name),actual=local.getType(name);assert.ok(isObjectType(expected)||isInputObjectType(expected));assert.ok(isObjectType(actual)||isInputObjectType(actual));
   for(const [field,definition] of Object.entries(expected.getFields()))assert.equal(String(actual.getFields()[field]?.type),String(definition.type),name+'.'+field);
  }
  for(const [root,names] of [['Query',['customerTier','customerTiers']],['Mutation',['customerTierCreate','customerTierUpdate','customerTierDelete']]] as const){const expected=upstream.getType(root),actual=local.getType(root);assert.ok(isObjectType(expected)&&isObjectType(actual));for(const name of names){const a:GraphQLField<any,any>=actual.getFields()[name],e:GraphQLField<any,any>=expected.getFields()[name];assert.equal(String(a.type),String(e.type),root+'.'+name);const args=(fields:readonly GraphQLArgument[])=>Object.fromEntries([...fields].sort((a,b)=>a.name.localeCompare(b.name)).map(f=>[f.name,String(f.type)]));assert.deepEqual(args(a.args),args(e.args),root+'.'+name+' arguments');}}
 }finally{await f.app.close();}
});
