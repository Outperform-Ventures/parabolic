import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import type { Actor } from '../../src/server/repository.ts';

test('project statuses validate every category and prevent removal of statuses in use',async()=>{const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'owner@example.com',password:'owner-secure-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo;
  const statuses=['backlog','planned','started','completed','canceled'].map((type,sortOrder)=>({id:type==='planned'?'custom-planned':type,name:type==='planned'?'Scheduled':type,type,color:'#858699',sortOrder}));
  repo.update(actor,'workspaces',actor.workspaceId,{projectStatuses:statuses});const project=repo.create(actor,'projects',{name:'Scheduled project',status:'planned'});assert.equal(project.status,'custom-planned');assert.equal(project.completedAt,null);
  assert.throws(()=>repo.update(actor,'projects',project.id,{status:'unknown'}),/not available/);
  assert.throws(()=>repo.update(actor,'workspaces',actor.workspaceId,{projectStatuses:statuses.map(status=>status.type==='planned'?{...status,id:'replacement'}:status)}),/still in use/);
  assert.throws(()=>repo.update(actor,'workspaces',actor.workspaceId,{projectStatuses:statuses.filter(status=>status.type!=='canceled')}),/5–100|Each project/);
  assert.throws(()=>repo.update(actor,'workspaces',actor.workspaceId,{projectStatuses:statuses.map((status,i)=>i===4?{...status,name:statuses[0].name}:status)}),/unique/);
  assert.throws(()=>repo.update(actor,'workspaces',actor.workspaceId,{projectStatuses:statuses.map((status,i)=>i===4?{...status,color:'url(evil)'}:status)}),/hex color/);
  const done=repo.update(actor,'projects',project.id,{status:'completed'});assert.ok(done.completedAt);assert.equal(repo.update(actor,'projects',project.id,{status:'started'}).completedAt,null);
  const activeBefore=repo.raw('projects',project.id)!.status;const team=repo.all('teams',actor.workspaceId)[0];repo.create(actor,'issues',{title:'New project issue',teamId:team.id,projectId:project.id});assert.equal(repo.raw('projects',project.id)!.status,activeBefore,'Issue mutations do not automatically change project status');
}finally{await app.close();}});
