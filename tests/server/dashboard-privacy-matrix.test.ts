import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';

test('dashboard visibility matrix separates workspace, private-team and personal access for members and guests',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'matrix-owner@example.test',name:'Owner',password:'matrix-owner-password'}),owner:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo;
  const account=(name:string)=>{const user={id:crypto.randomUUID(),workspaceId:owner.workspaceId,name,email:name+'@example.test',version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};repo.save('users',user,'create',owner);return user;};const member=account('Member'),guest=account('Guest');
  for(const [user,role] of [[member,'member'],[guest,'guest']] as const)repo.save('memberships',{id:crypto.randomUUID(),workspaceId:owner.workspaceId,userId:user.id,role,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},'create',owner);
  const actors=[owner,{...owner,userId:member.id,role:'member',scopes:['read','write']},{...owner,userId:guest.id,role:'guest',scopes:['read','write']}] as Actor[];
  const privateTeam=repo.create(owner,'teams',{name:'Private dashboards',key:'PV',visibility:'private',memberIds:[owner.userId]}),workspace=repo.create(owner,'dashboards',{name:'Workspace',visibility:'workspace'}),personal=repo.create(owner,'dashboards',{name:'Personal',visibility:'private'}),privateDashboard=repo.create(owner,'dashboards',{name:'Team',visibility:'workspace',teamId:privateTeam.id});
  for(const actor of actors){assert.equal(repo.canRead(actor,'dashboards',workspace),actor.role!=='guest');assert.equal(repo.canRead(actor,'dashboards',personal),actor===owner);assert.equal(repo.canRead(actor,'dashboards',privateDashboard),actor===owner);}
  repo.update(owner,'teams',privateTeam.id,{memberIds:[owner.userId,member.id,guest.id]});
  for(const actor of actors)assert.equal(repo.canRead(actor,'dashboards',privateDashboard),true);
  assert.equal(repo.update(actors[2],'dashboards',privateDashboard.id,{name:'Guest edit'}).name,'Guest edit');
  repo.update(owner,'teams',privateTeam.id,{memberIds:[owner.userId]});for(const actor of actors.slice(1))assert.equal(repo.canRead(actor,'dashboards',privateDashboard),false);
 }finally{await app.close()}
});
