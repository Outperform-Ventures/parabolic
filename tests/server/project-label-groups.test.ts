import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';
test('projects reject multiple labels in one group atomically while permitting labels from distinct groups',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'project-group@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo;
 const label=(name:string,group?:string)=>repo.create(actor,'labels',{name,group,entityType:'projects'}),a=label('Small','Size'),b=label('Large','Size'),c=label('Customer','Audience'),d=label('Ungrouped');
 assert.throws(()=>repo.create(actor,'projects',{name:'Invalid',labelIds:[a.id,b.id]}),/only one label/);const p=repo.create(actor,'projects',{name:'Valid',labelIds:[a.id,c.id,d.id]});assert.throws(()=>repo.transaction(()=>{repo.update(actor,'projects',p.id,{name:'Should roll back'});repo.update(actor,'projects',p.id,{labelIds:[a.id,b.id]})}),/only one label/);assert.equal(repo.get(actor,'projects',p.id).name,'Valid');assert.deepEqual(repo.update(actor,'projects',p.id,{labelIds:[b.id,c.id,d.id]}).labelIds,[b.id,c.id,d.id]);
 }finally{await app.close()}
});
