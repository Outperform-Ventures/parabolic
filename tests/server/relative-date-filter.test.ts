import test from 'node:test';import assert from 'node:assert/strict';
import{createApp}from'../../src/server/app';import{searchEntities}from'../../src/server/search';import{matchesFilter as clientMatches,type FilterSpec}from'../../src/client/query';import type{Actor}from'../../src/server/repository';
test('saved relative filters resolve consistently in client, collections and search without freezing saved dates',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Relative Reader',email:'relative-reader@example.test',password:'date-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-09-06T02:00:00Z'),timeZone:'America/Los_Angeles'},team=repo.all('teams',actor.workspaceId)[0];
 const issues=['2026-09-05','2026-09-06','2026-09-07',null].map((dueDate,index)=>repo.create(actor,'issues',{title:'Relative '+index,teamId:team.id,dueDate}));
 const filter:FilterSpec={match:'all',conditions:[{field:'dueDate',operator:'lte',value:'P1D'}]},saved=repo.create(actor,'views',{name:'Next day',entityType:'issues',filters:filter});
 const assertSame=(reader:Actor,expected:string[])=>{assert.deepEqual(repo.list(reader,'issues',{filter}).nodes.map(i=>i.id).sort(),expected.sort());assert.deepEqual(searchEntities(repo,reader,'Relative',{filter}).nodes.map(i=>i.id).sort(),expected.sort());assert.deepEqual(issues.filter(i=>clientMatches(i,filter,undefined,undefined,undefined,{now:reader.now,timeZone:reader.timeZone})).map(i=>i.id).sort(),expected.sort());};
 assertSame(actor,[issues[0].id,issues[1].id]);assertSame({...actor,timeZone:'Asia/Tokyo'},issues.slice(0,3).map(i=>i.id));assertSame({...actor,now:new Date('2026-09-07T02:00:00Z')},issues.slice(0,3).map(i=>i.id));
 assert.equal(repo.get(actor,'views',saved.id).filters.conditions[0].value,'P1D');
 for(const f of [{dueDate:{lte:'P1D'}},{and:[{dueDate:{lte:'P1D'}},{not:{dueDate:{lt:'P0D'}}}]}])assert.equal(repo.list(actor,'issues',{filter:f}).totalCount,2);
 const page=repo.list(actor,'issues',{filter,first:1});assert.equal(page.totalCount,2);assert.equal(repo.list(actor,'issues',{filter,first:1,after:page.pageInfo.endCursor!}).nodes.length,1);
 const search=searchEntities(repo,actor,'Relative',{filter,first:1});assert.throws(()=>searchEntities(repo,{...actor,timeZone:'Asia/Tokyo'},'Relative',{filter,first:1,after:search.pageInfo.endCursor!}),/another query/);
 }finally{await app.close()}
});
