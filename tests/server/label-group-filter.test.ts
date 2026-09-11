import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {searchEntities} from '../../src/server/search';
import type {Actor} from '../../src/server/repository';
test('API group filters resolve current children with exact group identity, boolean semantics and pagination',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'group-api@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
 const old=repo.create(actor,'labels',{name:'Area'}),filter={conditions:[{field:'labelIds',operator:'eq',value:old.id}],match:'all'};
 repo.update(actor,'labels',old.id,{convertTo:'labelGroups'});
 const other=repo.create(actor,'labelGroups',{name:'Area',teamId:team.id}),empty=repo.create(actor,'labelGroups',{name:'Empty'});
 const child=repo.create(actor,'labels',{name:'Web',labelGroupId:old.id}),peer=repo.create(actor,'labels',{name:'Mobile',labelGroupId:other.id,teamId:team.id});
 const a=repo.create(actor,'issues',{title:'Group alpha',teamId:team.id,labelIds:[child.id]}),b=repo.create(actor,'issues',{title:'Group beta',teamId:team.id,labelIds:[child.id]}),c=repo.create(actor,'issues',{title:'Group gamma',teamId:team.id,labelIds:[peer.id]}),d=repo.create(actor,'issues',{title:'Group delta',teamId:team.id});
 const ids=(f:any)=>repo.list(actor,'issues',{filter:f}).nodes.map(i=>i.id).sort();
 assert.deepEqual(ids(filter),[a.id,b.id].sort());assert.equal(searchEntities(repo,actor,'Group',{filter}).totalCount,2);
 const first=repo.list(actor,'issues',{filter,first:1});assert.equal(first.totalCount,2);assert.equal(repo.list(actor,'issues',{filter,first:1,after:first.pageInfo.endCursor!}).nodes.length,1);
 for(const f of [{labelIds:{contains:old.id}},{labelIds:{containsAll:[old.id]}},{and:[filter,{not:{labelIds:{contains:peer.id}}}]}])assert.deepEqual(ids(f),[a.id,b.id].sort());
 assert.throws(()=>ids({labelIds:{contains:[old.id]}}),/scalar/);
 assert.deepEqual(ids({not:filter}),[c.id,d.id].sort());
 for(const op of ['eq','in','all','neq','notContains','none']){const f={conditions:[{field:'labelIds',operator:op,value:['in','all','none'].includes(op)?[empty.id]:empty.id}]};assert.equal(ids(f).length,['neq','notContains','none'].includes(op)?4:0);assert.equal(searchEntities(repo,actor,'Group',{filter:f}).totalCount,ids(f).length)}
 repo.update(actor,'labels',child.id,{labelGroupId:null,group:null});assert.equal(ids(filter).length,0);
 repo.update(actor,'labels',child.id,{labelGroupId:old.id});assert.equal(ids(filter).length,2);
 const canRead=repo.canRead.bind(repo);repo.canRead=(a,k,e)=>k==='labels'&&e?.id===child.id?false:canRead(a,k,e);assert.equal(ids(filter).length,0);assert.equal(searchEntities(repo,actor,'Group',{filter}).totalCount,0);repo.canRead=canRead;
 const group=repo.create(actor,'labelGroups',{name:'Phase',entityType:'projects'}),pl=repo.create(actor,'labels',{name:'Pilot',entityType:'projects',labelGroupId:group.id}),project=repo.create(actor,'projects',{name:'Group parent',teamIds:[team.id],labelIds:[pl.id]});repo.update(actor,'issues',a.id,{projectId:project.id});
 assert.deepEqual(ids({conditions:[{field:'projectLabelIds',operator:'eq',value:group.id}]}),[a.id]);
 assert.equal(searchEntities(repo,actor,'Group',{kinds:['projects'],filter:{labelIds:{contains:group.id}}}).totalCount,1);
 const policy=repo.create(actor,'slaPolicies',{name:'Group SLA',duration:2,durationUnit:'hour',action:'apply',enabled:true,filter});
 repo.create(actor,'automations',{name:'Group triage',type:'routing',teamId:team.id,filter,set:{priority:1}});
 const triage=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type==='triage')!;
 const incoming=repo.create(actor,'issues',{title:'Group incoming',teamId:team.id,statusId:triage.id,labelIds:[child.id]});assert.equal(incoming.priority,1);assert.equal(incoming.slaPolicyId,policy.id);
 const plain=repo.create(actor,'issues',{title:'Unmatched incoming',teamId:team.id,statusId:triage.id});assert.equal(plain.priority,0);assert.equal(plain.slaPolicyId??null,null);
 }finally{await app.close()}
});
