import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {searchEntities} from '../../src/server/search';
import type {Actor} from '../../src/server/repository';

test('upstream project label filters track changes, pagination, historical labels and readable parents',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'project-filter@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
 const label=repo.create(actor,'labels',{name:'Large',entityType:'projects'}),project=repo.create(actor,'projects',{name:'Parent',teamIds:[team.id],labelIds:[label.id]});
 const first=repo.create(actor,'issues',{title:'Upstream first',teamId:team.id,projectId:project.id}),second=repo.create(actor,'issues',{title:'Upstream second',teamId:team.id,projectId:project.id});
 const standalone=repo.create(actor,'issues',{title:'Upstream standalone',teamId:team.id});
 const filter={conditions:[{field:'projectLabelIds',operator:'eq',value:label.id}],match:'all'};
 const ids=()=>repo.list(actor,'issues',{filter}).nodes.map(i=>i.id).sort();
 assert.deepEqual(ids(),[first.id,second.id].sort());assert.equal(searchEntities(repo,actor,'Upstream',{filter}).totalCount,2);
 const page=repo.list(actor,'issues',{filter,first:1});assert.equal(page.totalCount,2);assert.equal(repo.list(actor,'issues',{filter,first:1,after:page.pageInfo.endCursor!}).nodes.length,1);
 assert.deepEqual(repo.list(actor,'issues',{filter:{conditions:[{field:'projectLabelIds',operator:'empty'}]}}).nodes.map(i=>i.id),[standalone.id]);
 repo.update(actor,'labels',label.id,{archivedAt:new Date().toISOString()});assert.equal(ids().length,2);
 repo.update(actor,'projects',project.id,{labelIds:[]});assert.equal(ids().length,0);assert.equal(searchEntities(repo,actor,'Upstream',{filter}).totalCount,0);
 repo.update(actor,'labels',label.id,{archivedAt:null});repo.update(actor,'projects',project.id,{labelIds:[label.id]});
 const canRead=repo.canRead.bind(repo);repo.canRead=(a,k,e)=>k==='projects'&&e?.id===project.id?false:canRead(a,k,e);
 assert.equal(ids().length,0);assert.equal(searchEntities(repo,actor,'Upstream',{filter}).totalCount,0);
 repo.canRead=canRead;
 assert.deepEqual(repo.get(actor,'issues',first.id).labelIds??[],[]);
 }finally{await app.close()}
});
