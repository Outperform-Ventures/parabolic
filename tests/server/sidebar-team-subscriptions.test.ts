import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';
test('team subscription options deliver only selected transitions, suppress self edits, and stop after removal',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
 const setup=await app.auth.setup({name:'Owner',email:'sidebar-owner@example.test',password:'owner-password'}),repo=app.repo;
 const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},at=new Date().toISOString(),id=randomUUID();
 repo.save('users',{id,workspaceId:actor.workspaceId,name:'Subscriber',email:'sidebar-member@example.test',createdAt:at,updatedAt:at,version:1},'create',actor);
 repo.save('memberships',{id:randomUUID(),workspaceId:actor.workspaceId,userId:id,role:'member',createdAt:at,updatedAt:at,version:1},'create',actor);
 const member:Actor={...actor,userId:id,role:'member',scopes:['read','write']},team=repo.all('teams',actor.workspaceId)[0],statuses=repo.all('statuses',actor.workspaceId).filter(s=>s.teamId===team.id),status=(type:string)=>statuses.find(s=>s.type===type)!.id;
 const sub=repo.create(member,'subscriptions',{entityKind:'teams',entityId:team.id,notifyOnAdded:true});
 const alerts=()=>repo.list(member,'notifications').nodes.filter(n=>n.reasons?.includes('subscriptions'));
 assert.throws(()=>repo.create(member,'subscriptions',{entityKind:'teams',entityId:team.id,notifyOnAdded:true}),/Already subscribed/);
 const issue=repo.create(actor,'issues',{title:'Added',teamId:team.id,statusId:status('unstarted')});assert.equal(alerts().length,1);
 repo.update(actor,'issues',issue.id,{title:'Edited'});assert.equal(alerts().length,1);
 repo.update(actor,'issues',issue.id,{statusId:status('completed')});assert.equal(alerts().length,1);
 repo.update(member,'subscriptions',sub.id,{notifyOnAdded:false,notifyOnClosed:true,notifyOnTriage:true});
 repo.update(actor,'issues',issue.id,{statusId:status('unstarted')});repo.update(actor,'issues',issue.id,{statusId:status('canceled')});assert.equal(alerts().length,2);
 const triage=statuses.find(s=>s.type==='triage')||repo.create(actor,'statuses',{name:'Triage',type:'triage',teamId:team.id,color:'#999'});
 repo.update(actor,'issues',issue.id,{statusId:triage.id});assert.equal(alerts().length,3);
 repo.update(member,'issues',issue.id,{statusId:status('completed')});assert.equal(alerts().length,3);
 repo.remove(member,'subscriptions',sub.id);repo.update(actor,'issues',issue.id,{statusId:triage.id});assert.equal(alerts().length,3);
 assert.throws(()=>repo.create(member,'subscriptions',{entityKind:'teams',entityId:team.id,notifyOnAdded:'yes'}),/booleans/);
 }finally{await app.close();}
});
