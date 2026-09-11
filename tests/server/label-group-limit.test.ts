import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';
test('label groups cap membership at 250 per scope and type and roll back failed moves',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'label-limit@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo;
 const members=repo.transaction(()=>Array.from({length:250},(_,i)=>repo.create(actor,'labels',{name:'Label '+i,group:'Type'})));
 assert.throws(()=>repo.create(actor,'labels',{name:'Overflow',group:'Type'}),/at most 250/);
 assert.equal(repo.update(actor,'labels',members[0].id,{description:'Still editable'}).description,'Still editable');
 const team=repo.all('teams',actor.workspaceId)[0];repo.create(actor,'labels',{name:'Team label',group:'Type',teamId:team.id});repo.create(actor,'labels',{name:'Project label',group:'Type',entityType:'projects'});
 const outside=repo.create(actor,'labels',{name:'Outside'});
 assert.throws(()=>repo.transaction(()=>{repo.update(actor,'labels',outside.id,{description:'Should roll back'});repo.update(actor,'labels',outside.id,{group:'Type'})}),/at most 250/);
 assert.equal(repo.get(actor,'labels',outside.id).description,undefined);
 repo.update(actor,'labels',members[0].id,{archivedAt:new Date().toISOString()});assert.throws(()=>repo.update(actor,'labels',outside.id,{group:'Type'}),/at most 250/);
 repo.remove(actor,'labels',members[0].id);assert.equal(repo.update(actor,'labels',outside.id,{group:'Type'}).group,'Type');
 }finally{await app.close()}
});
