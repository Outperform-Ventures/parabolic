import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';import {reservedIssueLabelNames} from '../../src/shared/label-name-validation';
test('reserved issue-label names reject new labels, renames and type conversions without breaking historical edits',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'label-names@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo;
 for(const name of reservedIssueLabelNames)assert.throws(()=>repo.create(actor,'labels',{name:' '+name.toUpperCase()+' '}),(e:any)=>e.code==='RESERVED_LABEL_NAME');
 assert.throws(()=>repo.create(actor,'labels',{name:'Priority',group:'Type'}),(e:any)=>e.code==='RESERVED_LABEL_NAME');
 const valid=repo.create(actor,'labels',{name:'Project work'});assert.throws(()=>repo.transaction(()=>{repo.update(actor,'labels',valid.id,{color:'#ffffff'});repo.update(actor,'labels',valid.id,{name:'Status'})}));assert.notEqual(repo.get(actor,'labels',valid.id).color,'#ffffff');
 const project=repo.create(actor,'labels',{name:'Status',entityType:'projects'});assert.throws(()=>repo.update(actor,'labels',project.id,{entityType:'issues'}),(e:any)=>e.code==='RESERVED_LABEL_NAME');
 repo.save('labels',{...valid,name:'Priority'},'update',actor);assert.equal(repo.update(actor,'labels',valid.id,{description:'Historical label'}).name,'Priority');assert.equal(repo.update(actor,'labels',valid.id,{name:'Legacy priority'}).name,'Legacy priority');
 }finally{await app.close()}
});
