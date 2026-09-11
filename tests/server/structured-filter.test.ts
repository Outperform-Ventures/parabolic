import test from'node:test';import assert from'node:assert/strict';import{createApp}from'../../src/server/app';import{searchEntities}from'../../src/server/search';import{matchesFilter as client}from'../../src/client/query';import type{Actor}from'../../src/server/repository';
test('nested structured filters agree across repository, search and client, including negated condition blocks',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Nested Reader',email:'nested@example.test',password:'nested-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-09-06T12:00:00Z'),timeZone:'UTC'},team=repo.all('teams',actor.workspaceId)[0];
 const issues=[1,2,3].map(priority=>repo.create(actor,'issues',{title:'Nested '+priority,priority,teamId:team.id}));
 const filter={and:[{or:[{priority:{eq:1}},{conditions:[{field:'priority',operator:'eq',value:2}],match:'all'}]},{not:{conditions:[{field:'priority',operator:'eq',value:2}],match:'all'}},{createdAt:{gte:'-P1D'}}]};
 for(const [selected,expected]of [[filter,[issues[0].id]],[{or:[]},[]]] as const){assert.deepEqual(repo.list(actor,'issues',{filter:selected}).nodes.map(i=>i.id),expected);assert.deepEqual(searchEntities(repo,actor,'Nested',{filter:selected}).nodes.map(i=>i.id),expected);assert.deepEqual(issues.filter(i=>client(i,selected,undefined,undefined,undefined,actor)).map(i=>i.id),expected)}
 const saved=repo.create(actor,'views',{name:'Nested API view',entityType:'issues',filters:filter});assert.deepEqual(repo.get(actor,'views',saved.id).filters,filter);
 }finally{await app.close()}
});
