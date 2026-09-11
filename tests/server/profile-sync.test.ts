import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app.ts';
import type {Actor,Change} from '../../src/server/repository.ts';

test('global profile changes reach every joined workspace without exposing private preferences or originating workspace',async()=>{const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({name:'Owner',email:'owner@example.test',password:'owner-password'}),repo=app.repo;const first:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};const otherWorkspace=app.auth.createWorkspace(first.userId,'Second workspace'),second={...first,workspaceId:otherWorkspace.workspaceId},id=randomUUID(),at=new Date().toISOString();repo.save('users',{id,workspaceId:second.workspaceId,name:'Second-workspace colleague',email:'colleague@example.test',createdAt:at,updatedAt:at,version:1},'create',second);const membership=repo.create(second,'memberships',{userId:first.userId,teamId:repo.all('teams',second.workspaceId)[0].id,role:'member'});repo.save('memberships',{id:randomUUID(),workspaceId:second.workspaceId,userId:id,role:'member',createdAt:at,updatedAt:at,version:1},'create',second);const colleague={...second,userId:id,role:'member',scopes:['read','write']};const beforeFirst=repo.state(first).seq,beforeSecond=repo.state(second).seq,events:Change[]=[];const listener=repo.onChanges;repo.onChanges=changes=>{events.push(...changes);listener?.(changes);};repo.update(second,'users',first.userId,{name:'New name',preferences:{privateIssue:'secret-private-id',theme:'light'}});const profileEvents=events.filter(e=>e.kind==='users');assert.deepEqual(profileEvents.map(e=>e.workspaceId).sort(),[first.workspaceId,second.workspaceId].sort());assert.equal(repo.changes(first,beforeFirst).events.filter((e:any)=>e.kind==='users').length,1);const delivered=repo.changes(colleague,beforeSecond).events.find((e:any)=>e.kind==='users')!.entity;assert.equal(delivered.name,'New name');assert.equal(delivered.workspaceId,second.workspaceId);assert.equal(delivered.preferences,undefined);assert.ok(!JSON.stringify(delivered).includes('secret-private-id'));assert.equal(repo.present(second,'users',repo.raw('users',first.userId)!).preferences.theme,'light');assert.ok(repo.scan(colleague,'users').nodes.some(user=>user.id===first.userId));
  for(const m of repo.all('memberships',first.workspaceId).filter(m=>m.userId===first.userId))repo.save('memberships',{...m,deletedAt:new Date().toISOString()},'delete',first);events.length=0;repo.update(second,'users',first.userId,{name:'After leaving first workspace'});assert.deepEqual(events.filter(e=>e.kind==='users').map(e=>e.workspaceId),[second.workspaceId]);
}finally{await app.close();}});

test('imported profile email does not block preferences or allow account email changes',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
  const setup=await app.auth.setup({name:'Imported owner',email:'login@example.test',password:'owner-password'});
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};
  const profile=app.repo.raw('users',actor.userId)!;
  app.repo.save('users',{...profile,email:'parabolic-profile@example.test'},'update',actor);
  const preferences={issueCustomerRequests:{[actor.workspaceId]:{order:'revenue',reversed:true}}};
  const updated=app.repo.update(actor,'users',actor.userId,{preferences});
  assert.deepEqual(updated.preferences,preferences);
  assert.equal(updated.email,'parabolic-profile@example.test');
  assert.equal(app.repo.update(actor,'users',actor.userId,{email:updated.email,name:'Updated owner'}).name,'Updated owner');
  assert.throws(()=>app.repo.update(actor,'users',actor.userId,{email:'unauthorized@example.test'}),/Account email cannot be changed/);
  assert.equal((app.db.prepare('SELECT email FROM accounts WHERE id=?').get(actor.userId) as any).email,'login@example.test');
 }finally{await app.close();}
});
