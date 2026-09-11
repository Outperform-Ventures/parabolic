import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import { searchEntities } from '../../src/server/search.ts';
import type { Actor } from '../../src/server/repository.ts';
import { buildApiSchema, executeGraphql } from '../../src/server/graphql.ts';

test('FTS search counts and paginates beyond ten thousand matches and enforces private parent access',async()=>{const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'owner@example.com',password:'owner-secure-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};const repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];repo.transaction(()=>{for(let i=0;i<10011;i++)repo.create(actor,'issues',{title:`Overflow needle ${i}`,teamId:team.id});});
  const scoped={...actor,scopes:['issues:read']};let after:string|undefined,total=0;const seen=new Set<string>();do{const page=searchEntities(repo,scoped,'needle',{kinds:['issues'],first:500,after});assert.equal(page.totalCount,10011);for(const node of page.nodes){assert.ok(!seen.has(node.id));seen.add(node.id);}total+=page.nodes.length;after=page.pageInfo.hasNextPage?page.pageInfo.endCursor!:undefined;}while(after);assert.equal(total,10011);
  const first=searchEntities(repo,scoped,'needle',{kinds:['issues'],first:1});assert.throws(()=>searchEntities(repo,scoped,'different',{kinds:['issues'],after:first.pageInfo.endCursor!}),/another query/);
  const graphql=await executeGraphql(buildApiSchema(repo),scoped,{query:'{ viewer { id } search(query:"needle",kinds:["issues"],first:2) }'});assert.equal(graphql.errors,undefined);assert.equal((graphql.data!.search as any).totalCount,10011);assert.equal((graphql.data!.search as any).nodes.length,2);
  const privateTeam=repo.create(actor,'teams',{name:'Private',key:'PVT',private:true,memberIds:[actor.userId]});const hidden=repo.create(actor,'issues',{title:'Needle privacy check',teamId:privateTeam.id});assert.equal(searchEntities(repo,scoped,'privacy',{kinds:['issues']}).nodes[0].id,hidden.id);const other={...scoped,userId:'unrelated-member',role:'member'};assert.equal(searchEntities(repo,other,'privacy',{kinds:['issues']}).totalCount,0);assert.equal(searchEntities(repo,other,'needle',{kinds:['issues']}).totalCount,10011);
}finally{await app.close();}});

test('Search phrases, stopwords, shorthand and comment matches use the requested content boundary',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{
    const setup=await app.auth.setup({name:'Search owner',email:'search-language@example.test',password:'Search-language-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
    const exact=repo.create(actor,'issues',{teamId:team.id,title:'Compile fast parser',description:'<p>APIv2 &amp; rarebody</p>'}),scattered=repo.create(actor,'issues',{teamId:team.id,title:'Compile a parser that is fast'}),commentOnly=repo.create(actor,'issues',{teamId:team.id,title:'Different heading'});
    repo.create(actor,'comments',{issueId:commentOnly.id,body:'<p>The customer reported uniquefault after changing settings.</p>'});repo.create(actor,'comments',{issueId:commentOnly.id,body:'Another uniquefault report'});
    const ids=(q:string,options:Record<string,any>={})=>searchEntities(repo,actor,q,{kinds:['issues'],...options}).nodes.map(item=>item.id);
    assert.deepEqual(ids('"fast parser"'),[exact.id]);assert.deepEqual(new Set(ids('the fast parser')),new Set([exact.id,scattered.id]));assert.deepEqual(ids('"the fast parser"'),[]);
    assert.deepEqual(ids('APIv2'),[exact.id]);assert.deepEqual(ids(String(exact.identifier).replace('-','').toLowerCase(),{titleOnly:true}),[exact.id]);
    assert.deepEqual(ids('rarebody'),[exact.id]);assert.deepEqual(ids('rarebody',{titleOnly:true}),[]);assert.deepEqual(ids('uniquefault'),[commentOnly.id]);assert.deepEqual(ids('uniquefault',{titleOnly:true}),[]);
    const commentHit=searchEntities(repo,actor,'uniquefault',{kinds:['issues']}).nodes[0];assert.equal(commentHit.kind,'issues');assert.match(commentHit.matchSnippet??'',/uniquefault/);assert.equal(String(commentHit.matchSnippet).includes('<p>'),false);
    assert.equal(searchEntities(repo,{...actor,scopes:['issues:read']},'uniquefault',{kinds:['issues']}).totalCount,0);
    repo.update(actor,'issues',exact.id,{title:'Renamed searchable heading'});assert.deepEqual(ids('Compile',{titleOnly:true}),[scattered.id]);assert.deepEqual(ids('Renamed',{titleOnly:true}),[exact.id]);repo.remove(actor,'issues',exact.id);assert.deepEqual(ids('Renamed',{titleOnly:true}),[]);repo.restore(actor,'issues',exact.id);assert.deepEqual(ids('Renamed',{titleOnly:true}),[exact.id]);
  }finally{await app.close();}
});

test('Search ranks open issues, filters archives and compound customer metrics, and binds cursors to access context',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{
    const setup=await app.auth.setup({name:'Search filters',email:'search-filters@example.test',password:'Search-filters-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0],statuses=repo.all('statuses',actor.workspaceId),open=statuses.find(status=>status.type==='started')!,done=statuses.find(status=>status.type==='completed')!;
    const completed=repo.create(actor,'issues',{teamId:team.id,title:'Ranking sample completed',statusId:done.id,priority:3}),active=repo.create(actor,'issues',{teamId:team.id,title:'Ranking sample active',statusId:open.id,priority:1}),archived=repo.create(actor,'issues',{teamId:team.id,title:'Ranking sample archived',statusId:open.id,priority:1,archivedAt:'2026-01-01T00:00:00.000Z'});
    assert.deepEqual(searchEntities(repo,actor,'Ranking',{kinds:['issues']}).nodes.map(item=>item.id),[active.id,completed.id,archived.id]);assert.equal(searchEntities(repo,actor,'Ranking',{kinds:['issues'],includeArchived:false}).totalCount,2);
    const customer=repo.create(actor,'customers',{name:'Enterprise account',revenue:1200,tier:'enterprise'});repo.create(actor,'requests',{issueId:active.id,customerId:customer.id,title:'Requested fix',important:true});
    const metric=searchEntities(repo,actor,'',{kinds:['issues'],filter:{and:[{priority:{eq:1}},{customerRevenue:{gte:1000}},{customerImportant:true}]},includeArchived:false});assert.deepEqual(metric.nodes.map(item=>item.id),[active.id]);
    for(const [id,createdAt]of [[completed.id,'2025-01-01T00:00:00.000Z'],[active.id,'2025-02-01T00:00:00.000Z']])repo.db.prepare("UPDATE entities SET created_at=?,data=json_set(data,'$.createdAt',?) WHERE kind='issues' AND id=?").run(createdAt,createdAt,id);
    const compound=searchEntities(repo,actor,'',{kinds:['issues'],filter:{or:[{id:completed.id},{id:active.id}]},orderBy:'createdAt:asc'});assert.equal(compound.totalCount,2);assert.equal(compound.nodes[0].id,completed.id);
    const first=searchEntities(repo,actor,'Ranking',{kinds:['issues'],first:1});assert.throws(()=>searchEntities(repo,{...actor,userId:'different-user'},'Ranking',{kinds:['issues'],after:first.pageInfo.endCursor!}),/another query/);assert.throws(()=>searchEntities(repo,actor,'Ranking',{kinds:['issues'],includeArchived:false,after:first.pageInfo.endCursor!}),/another query/);
    assert.throws(()=>searchEntities(repo,actor,'Ranking',{orderBy:'arbitrary'}),/ordering/);assert.throws(()=>searchEntities(repo,actor,'Ranking',{filter:[] as any}),/Filter/);
    assert.equal(searchEntities(repo,actor,'',{kinds:['issues'],filter:{conditions:[],match:'all'}}).totalCount,0);
  }finally{await app.close();}
});

test('Search HTTP options and SDK filtering expose the same indexed results',async()=>{
  const {ParabolicClient}=await import('../../packages/sdk/src/client.ts');const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();try{
    const response=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Search SDK',email:'search-sdk@example.test',password:'Search-sdk-password'})});const client=new ParabolicClient({baseUrl:url,headers:{Cookie:response.headers.get('set-cookie')!.split(';')[0]}}),team=(await client.teams.list()).nodes[0],issue=await client.issues.create({title:'SDK title hit',teamId:team.id,description:'<p>Bodyboundary</p>',priority:1});
    assert.equal((await client.search('Bodyboundary',{kinds:['issues'],titleOnly:true})).totalCount,0);assert.equal((await client.search('Bodyboundary',{kinds:['issues']})).totalCount,1);assert.equal((await client.search('',{kinds:['issues'],filter:{priority:1},orderBy:'updatedAt:desc',includeArchived:false})).nodes[0].id,issue.id);
  }finally{await app.close();}
});
