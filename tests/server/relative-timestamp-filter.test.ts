import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {searchEntities} from '../../src/server/search';
import {matchesFilter as clientMatches,type FilterSpec} from '../../src/client/query';
import type {Actor} from '../../src/server/repository';

test('timestamp filters agree across client, collection and search; pagination retains its initial clock',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Timestamp Reader',email:'timestamp@example.test',password:'timestamp-password'}),repo=app.repo;
 const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-03-08T16:00:00Z'),timeZone:'America/New_York'},team=repo.all('teams',actor.workspaceId)[0];
 const issues=['2026-03-07T16:30:00Z','2026-03-07T17:00:00Z','2026-03-08T15:30:00Z'].map((at,index)=>repo.create({...actor,now:new Date(at)},'issues',{title:'Timestamp '+index,teamId:team.id}));
 const filter:FilterSpec={match:'all',conditions:[{field:'createdAt',operator:'gte',value:'-P1D'}]};
 const expected=issues.slice(1).map(i=>i.id).sort();
 assert.deepEqual(issues.filter(i=>clientMatches(i,filter,undefined,undefined,undefined,actor)).map(i=>i.id).sort(),expected);
 assert.deepEqual(repo.list(actor,'issues',{filter}).nodes.map(i=>i.id).sort(),expected);
 assert.deepEqual(repo.list(actor,'issues',{filter:{createdAt:{gte:'-PT24H'}}}).nodes.map(i=>i.id).sort(),issues.map(i=>i.id).sort());
 const saved=repo.create(actor,'views',{name:'Recent timestamps',entityType:'issues',filters:filter});
 const first=searchEntities(repo,actor,'Timestamp',{filter,first:1,orderBy:'createdAt:asc'});assert.equal(first.totalCount,2);assert.equal(first.nodes[0].id,issues[1].id);
 const later={...actor,now:new Date('2026-03-09T16:00:00Z')};
 const next=searchEntities(repo,later,'Timestamp',{filter,first:1,orderBy:'createdAt:asc',after:first.pageInfo.endCursor!});assert.equal(next.totalCount,2);assert.equal(next.nodes[0].id,issues[2].id);
 assert.equal(searchEntities(repo,later,'Timestamp',{filter}).totalCount,0);
 for(const changed of [{...actor,timeZone:'UTC'},{...actor,userId:'someone-else'}])assert.throws(()=>searchEntities(repo,changed,'Timestamp',{filter,first:1,orderBy:'createdAt:asc',after:first.pageInfo.endCursor!}),/another query/);
 const cursor=JSON.parse(Buffer.from(first.pageInfo.endCursor!,'base64url').toString());
 for(const anchor of ['invalid','2026-03-09T16:00:00.000Z'])assert.throws(()=>searchEntities(repo,actor,'Timestamp',{filter,orderBy:'createdAt:asc',after:Buffer.from(JSON.stringify({...cursor,anchor})).toString('base64url')}),/cursor/i);
 assert.equal(repo.get(actor,'views',saved.id).filters.conditions[0].value,'-P1D');
 }finally{await app.close()}
});

test('custom timestamp ranges cover viewer-local days including DST and keep their calendar representation',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Calendar Reader',email:'timestamp-days@example.test',password:'timestamp-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],timeZone:'America/New_York'},team=repo.all('teams',actor.workspaceId)[0];
 const issues=['2026-03-08T04:59:59Z','2026-03-08T05:00:00Z','2026-03-09T03:59:59Z','2026-03-09T04:00:00Z'].map((at,index)=>repo.create({...actor,now:new Date(at)},'issues',{title:'DST day '+index,teamId:team.id}));
 const filter:FilterSpec={match:'all',conditions:[{field:'createdAt',operator:'within',value:['2026-03-08','2026-03-09']}]},expected=issues.slice(1,3).map(i=>i.id).sort();
 assert.deepEqual(repo.list(actor,'issues',{filter}).nodes.map(i=>i.id).sort(),expected);assert.deepEqual(searchEntities(repo,actor,'DST day',{filter}).nodes.map(i=>i.id).sort(),expected);assert.deepEqual(issues.filter(i=>clientMatches(i,filter,undefined,undefined,undefined,actor)).map(i=>i.id).sort(),expected);
 assert.deepEqual(repo.resolveFilter(actor,{createdAt:{gte:'2026-03-08',lt:'2026-03-09'}}),{createdAt:{gte:'2026-03-08T05:00:00.000Z',lt:'2026-03-09T04:00:00.000Z'}});
 assert.deepEqual(filter.conditions[0].value,['2026-03-08','2026-03-09']);
 }finally{await app.close()}
});

test('on a date includes all instants of a local day and preserves the saved comparison',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'On Date',email:'on-date@example.test',password:'on-date-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],timeZone:'America/New_York'},team=repo.all('teams',actor.workspaceId)[0];
 const issues=['2026-11-01T03:59:59Z','2026-11-01T04:00:00Z','2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-02T04:59:59Z','2026-11-02T05:00:00Z'].map((at,index)=>repo.create({...actor,now:new Date(at)},'issues',{title:'On date '+index,teamId:team.id,dueDate:index===0?'2026-10-31':index===5?'2026-11-02':'2026-11-01'}));
 for(const field of ['createdAt','dueDate']){
 const filter:FilterSpec={match:'all',conditions:[{field,operator:'on',value:'2026-11-01'}]},expected=issues.slice(1,5).map(i=>i.id).sort(),saved=repo.create(actor,'views',{name:'On '+field,entityType:'issues',filters:filter});
 assert.deepEqual(repo.list(actor,'issues',{filter}).nodes.map(i=>i.id).sort(),expected);assert.deepEqual(searchEntities(repo,actor,'On date',{filter}).nodes.map(i=>i.id).sort(),expected);assert.deepEqual(issues.filter(i=>clientMatches(i,filter,undefined,undefined,undefined,actor)).map(i=>i.id).sort(),expected);assert.deepEqual(repo.get(actor,'views',saved.id).filters,filter);
 }
 const filter={conditions:[{field:'createdAt',operator:'on',value:'2026-11-01'}]};assert.deepEqual(repo.resolveFilter(actor,filter).conditions[0].value,['2026-11-01T04:00:00.000Z','2026-11-02T05:00:00.000Z']);
 }finally{await app.close()}
});
