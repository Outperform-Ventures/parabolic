import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';
test('dependency filters compute over readable projects without revealing hidden blocking relationships',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try {
  const setup=await app.auth.setup({name:'Owner',email:'dependency-access@example.test',password:'dependency-access-password'});
  const owner:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin'],now:new Date('2026-01-01')},repo=app.repo;
  const publicProject=repo.create(owner,'projects',{name:'Public project',targetDate:'2027-02-01'}),team=repo.create(owner,'teams',{name:'Private team',key:'PRV',private:true,memberIds:[owner.userId]});
  const hidden=repo.create(owner,'projects',{name:'Hidden project',teamId:team.id,teamIds:[team.id],dependencyIds:[publicProject.id],startDate:'2027-01-01'});
  const filter={hasBlockingDependency:{eq:true}},visible=repo.list(owner,'projects',{filter});assert.deepEqual(visible.nodes.map(project=>project.id),[publicProject.id]);
  const member:Actor={...owner,userId:'excluded-member',role:'member'};assert.equal(repo.canRead(member,'projects',hidden),false);assert.equal(repo.canRead(member,'projects',publicProject),true);
  assert.equal(repo.list(member,'projects',{filter}).totalCount,0);const enriched=repo.enrichProjectDependencies(member,'projects',[publicProject]);assert.equal(enriched[0].hasDependencies,false);assert.equal(enriched[0].hasViolatedDependencies,false);
 }finally{await app.close()}
});
