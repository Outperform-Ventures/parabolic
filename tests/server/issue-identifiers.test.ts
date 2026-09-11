import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {searchEntities} from '../../src/server/search';
import type {Actor} from '../../src/server/repository';
import {initializeIssueIdentifiers} from '../../src/server/issue-identifiers';
test('repeated team moves retain searchable issue identifiers and respect the current issue access',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
  const setup=await app.auth.setup({name:'Move owner',email:'move-owner@example.test',password:'Move-owner-password'});
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo;
  const team=repo.all('teams',actor.workspaceId)[0],next=repo.create(actor,'teams',{name:'Move destination',key:'DEST'});
  const original=repo.create(actor,'issues',{teamId:team.id,title:'Identifier survives moves',previousIdentifiers:['FORGED-1']});
  assert.deepEqual(original.previousIdentifiers,[]);
  const moved=repo.update(actor,'issues',original.id,{teamId:next.id});
  const returned=repo.update(actor,'issues',original.id,{teamId:team.id});
  assert.deepEqual(returned.previousIdentifiers,[original.identifier,moved.identifier]);
  repo.update(actor,'issues',original.id,{title:'Current moved title',previousIdentifiers:['FORGED-2']});
  for(const identifier of [original.identifier,moved.identifier,returned.identifier]){
   assert.equal(repo.get(actor,'issues',identifier.toLowerCase()).id,original.id);
   for(const titleOnly of [true,false])assert.equal(searchEntities(repo,actor,identifier.replace('-',''),{kinds:['issues'],titleOnly}).nodes[0]?.id,original.id);
  }
  assert.throws(()=>repo.get(actor,'issues','FORGED-2'),/not found/);
  assert.throws(()=>repo.get({...actor,workspaceId:'other'},'issues',original.identifier),/not found/);
  repo.remove(actor,'issues',original.id);assert.throws(()=>repo.get(actor,'issues',original.identifier),/not found/);
  assert.equal(repo.get(actor,'issues',original.identifier,true).id,original.id);
  repo.restore(actor,'issues',original.id);assert.equal(repo.get(actor,'issues',original.identifier).id,original.id);
  repo.db.prepare("UPDATE entities SET data=json_remove(data,'$.previousIdentifiers') WHERE kind='issues' AND id=?").run(original.id);
  repo.db.prepare("DELETE FROM data_migrations WHERE name='historical-issue-identifiers-v1'").run();
  initializeIssueIdentifiers(repo);
  assert.equal(repo.get(actor,'issues',original.identifier).id,original.id);
  assert.equal(searchEntities(repo,actor,original.identifier,{kinds:['issues'],titleOnly:true}).nodes[0]?.id,original.id);
  const version=repo.get(actor,'issues',original.id).version;initializeIssueIdentifiers(repo);assert.equal(repo.get(actor,'issues',original.id).version,version);
 }finally{await app.close()}
});
