import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app.ts';
import type {Actor} from '../../src/server/repository.ts';
import {triageAction} from '../../src/server/triage.ts';
import {mergeIssue} from '../../src/server/issue-operations.ts';

test('workflow category is chosen on creation and cannot change on existing statuses or affect assigned issues',async()=>{
  const app=createApp({databasePath:':memory:',port:0});
  try{
    const setup=await app.auth.setup({name:'Owner',email:'workflow-owner@example.test',password:'workflow-status-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-06-01T12:00:00Z')},team=repo.all('teams',actor.workspaceId)[0];
    const status=repo.create(actor,'statuses',{name:'Custom ready',type:'unstarted',teamId:team.id,color:'#858699',position:7}),issue=repo.create(actor,'issues',{title:'Awaiting work',teamId:team.id,statusId:status.id}),beforeActivities=repo.all('activities',actor.workspaceId),beforeSequence=repo.state(actor).seq;
    for(const type of ['started','completed','canceled'])assert.throws(()=>repo.update(actor,'statuses',status.id,{type,name:'Should not save',hierarchySync:true,system:true}),(error:any)=>error.status===422&&error.code==='IMMUTABLE_STATUS_CATEGORY');
    assert.deepEqual(repo.raw('statuses',status.id),status);assert.deepEqual(repo.raw('issues',issue.id),issue);assert.deepEqual(repo.all('activities',actor.workspaceId),beforeActivities);assert.equal(repo.state(actor).seq,beforeSequence);
    const changed=repo.update(actor,'statuses',status.id,{name:'Ready for implementation',description:'Fully specified work',color:'#12abcd',position:9,type:'unstarted'});
    assert.equal(changed.type,'unstarted');assert.equal(changed.name,'Ready for implementation');assert.equal(changed.description,'Fully specified work');assert.equal(changed.color,'#12abcd');assert.equal(changed.position,9);assert.equal(changed.version,status.version+1);assert.deepEqual(repo.raw('issues',issue.id),issue);
    const activity=repo.all('activities',actor.workspaceId).find(row=>row.entityId===status.id&&row.action==='update')!;assert.deepEqual(Object.keys(activity.changes).sort(),['color','description','name','position']);
    const completed=repo.create(actor,'statuses',{name:'Shipped',type:'completed',teamId:team.id});assert.equal(completed.type,'completed');assert.equal(repo.create(actor,'issues',{title:'Already shipped',teamId:team.id,statusId:completed.id}).completedAt,actor.now!.toISOString());
  }finally{await app.close();}
});

test('normal workflow categories retain their last status and deleting a spare default falls back to first Backlog',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{
    const setup=await app.auth.setup({name:'Owner',email:'workflow-retention@example.test',password:'workflow-status-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},team=repo.all('teams',actor.workspaceId)[0],statuses=repo.all('statuses',actor.workspaceId),before=repo.all('activities',actor.workspaceId);
    for(const category of ['backlog','unstarted','started','completed','canceled']){const status=statuses.find(s=>s.teamId===team.id&&s.type===category)!;assert.throws(()=>repo.remove(actor,'statuses',status.id),(e:any)=>e.code==='LAST_WORKFLOW_STATUS');}
    assert.deepEqual(repo.all('activities',actor.workspaceId),before);const spare=repo.create(actor,'statuses',{name:'Earliest backlog',type:'backlog',position:-1,teamId:team.id}),later=repo.create(actor,'statuses',{name:'Later backlog',type:'backlog',position:10,teamId:team.id});
    assert.equal(repo.create(actor,'issues',{title:'First backlog fallback',teamId:team.id}).statusId,spare.id);
    const todo=statuses.find(s=>s.teamId===team.id&&s.type==='unstarted')!;repo.update(actor,'teams',team.id,{defaultStatusId:todo.id});assert.equal(repo.create(actor,'issues',{title:'Explicit Todo',teamId:team.id}).statusId,todo.id);
    for(const status of statuses.filter(s=>s.teamId===team.id&&!['backlog','unstarted'].includes(s.type)))assert.throws(()=>repo.update(actor,'teams',team.id,{defaultStatusId:status.id}),(e:any)=>e.code==='INVALID_TRIAGE_SETTING');
    repo.update(actor,'teams',team.id,{defaultStatusId:later.id});repo.remove(actor,'statuses',later.id);assert.equal(repo.raw('teams',team.id)!.defaultStatusId,null);const triage=statuses.find(s=>s.teamId===team.id&&s.type==='triage')!,incoming=repo.create(actor,'issues',{title:'Accept to default Backlog',teamId:team.id,statusId:triage.id});assert.equal(triageAction(repo,actor,incoming.id,{action:'accept'}).issue.statusId,spare.id);
    repo.update(actor,'teams',team.id,{defaultStatusId:todo.id});const second=repo.create(actor,'issues',{title:'Accept to explicit Todo',teamId:team.id,statusId:triage.id});assert.equal(triageAction(repo,actor,second.id,{action:'accept'}).issue.statusId,todo.id);
    const other=repo.create(actor,'teams',{name:'Other',key:'OTHER'});assert.throws(()=>repo.update(actor,'statuses',todo.id,{teamId:other.id}),(e:any)=>e.code==='IMMUTABLE_STATUS_TEAM');assert.throws(()=>repo.remove(actor,'statuses',spare.id),(e:any)=>e.code==='IN_USE');
  }finally{await app.close();}
});

test('Duplicate remains system-managed and duplicate merges create a consistent inherited definition',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{
    const setup=await app.auth.setup({name:'Owner',email:'workflow-duplicate@example.test',password:'workflow-status-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},parent=repo.all('teams',actor.workspaceId)[0];
    assert.throws(()=>repo.create(actor,'statuses',{teamId:parent.id,name:'Arbitrary duplicate',type:'duplicate',system:true,hierarchySync:true}),(e:any)=>e.code==='SYSTEM_WORKFLOW_STATUS');
    const child=repo.create(actor,'teams',{name:'Inherited',key:'INHERIT',parentId:parent.id,inheritStatuses:true}),source=repo.create(actor,'issues',{title:'Duplicate report',teamId:child.id}),target=repo.create(actor,'issues',{title:'Canonical report',teamId:child.id}),merged=mergeIssue(repo,actor,source.id,target.id),duplicate=repo.raw('statuses',merged.issue.statusId)!;
    assert.equal(duplicate.name,'Duplicate');assert.equal(duplicate.type,'duplicate');assert.equal(repo.raw('statuses',duplicate.inheritedStatusId)!.teamId,parent.id);assert.ok(merged.issue.completedAt);
    const parentDuplicate=repo.raw('statuses',duplicate.inheritedStatusId)!;for(const patch of [{name:'Rename'},{color:'#abcdef'},{description:'Customize'},{position:1}])assert.throws(()=>repo.update(actor,'statuses',parentDuplicate.id,patch),(e:any)=>e.code==='SYSTEM_WORKFLOW_STATUS');assert.throws(()=>repo.remove(actor,'statuses',parentDuplicate.id),(e:any)=>e.code==='SYSTEM_WORKFLOW_STATUS');
    repo.update(actor,'teams',parent.id,{name:'Renamed parent'});assert.equal(repo.raw('issues',source.id)!.statusId,duplicate.id);assert.equal(repo.all('statuses',actor.workspaceId).filter(s=>s.teamId===child.id&&s.type==='duplicate').length,1);
    assert.throws(()=>repo.create(actor,'statuses',{teamId:child.id,name:'Local inherited override',type:'backlog'}),(e:any)=>e.code==='INHERITED_SETTING');
  }finally{await app.close();}
});

test('workflow inheritance remaps a removed default and preserves required categories during reconciliation',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{
    const setup=await app.auth.setup({name:'Owner',email:'workflow-inherit@example.test',password:'workflow-status-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},parent=repo.all('teams',actor.workspaceId)[0],child=repo.create(actor,'teams',{name:'Child',key:'CHILD',parentId:parent.id}),custom=repo.create(actor,'statuses',{name:'Child backlog',type:'backlog',teamId:child.id}),issue=repo.create(actor,'issues',{title:'Keep backlog assignment',teamId:child.id,statusId:custom.id});repo.update(actor,'teams',child.id,{defaultStatusId:custom.id});repo.update(actor,'teams',child.id,{inheritStatuses:true});const updatedTeam=repo.raw('teams',child.id)!,defaultStatus=repo.raw('statuses',updatedTeam.defaultStatusId)!;assert.equal(defaultStatus.type,'backlog');assert.equal(defaultStatus.teamId,child.id);assert.equal(repo.raw('issues',issue.id)!.statusId,defaultStatus.id);assert.ok(repo.raw('statuses',custom.id,true)!.deletedAt);
    const extra=repo.create(actor,'statuses',{name:'Spare Backlog',type:'backlog',teamId:parent.id});repo.remove(actor,'statuses',extra.id);assert.equal(repo.all('statuses',actor.workspaceId).filter(s=>s.teamId===child.id&&s.type==='backlog').length,1);
    const incomplete=repo.create(actor,'teams',{name:'Explicit incomplete fixture',key:'EMPTY',initializeWorkflow:false});repo.create(actor,'statuses',{name:'Only Todo',type:'unstarted',teamId:incomplete.id});assert.throws(()=>repo.update(actor,'teams',child.id,{parentId:incomplete.id}),(e:any)=>e.code==='WORKFLOW_NORMALIZATION_REQUIRED');assert.equal(repo.raw('teams',child.id)!.parentId,parent.id);assert.equal(repo.raw('issues',issue.id)!.statusId,defaultStatus.id);
  }finally{await app.close();}
});

test('REST, atomic batch and GraphQL reject workflow recategorization without partial history or issue writes',async()=>{
  const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();
  try{
    const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Owner',email:'workflow-http@example.test',password:'workflow-status-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],headers={cookie,'content-type':'application/json'},state=await(await fetch(url+'/api/v1/state',{headers})).json(),status=state.statuses.find((row:any)=>row.type==='unstarted');
    const created=await fetch(url+'/api/v1/issues',{method:'POST',headers,body:JSON.stringify({title:'Keep original title',teamId:status.teamId,statusId:status.id})}),issue=app.repo.raw('issues',(await created.json()).id)!,activities=app.repo.all('activities',state.workspaceId),sequence=(app.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq;
    const patch=await fetch(url+'/api/v1/statuses/'+status.id,{method:'PATCH',headers,body:JSON.stringify({type:'completed'})});assert.equal(patch.status,422);assert.equal((await patch.json()).error.code,'IMMUTABLE_STATUS_CATEGORY');
    const batch=await fetch(url+'/api/v1/batch',{method:'POST',headers,body:JSON.stringify({operations:[{kind:'issues',action:'update',id:issue.id,data:{title:'Must roll back'}},{kind:'statuses',action:'update',id:status.id,data:{type:'completed'}}]})});assert.equal(batch.status,422);assert.equal((await batch.json()).error.code,'IMMUTABLE_STATUS_CATEGORY');
    const graph=await(await fetch(url+'/graphql',{method:'POST',headers,body:JSON.stringify({query:'mutation($id:String!){workflowStateUpdate(id:$id,input:{type:"completed"}){success}}',variables:{id:status.id}})})).json();assert.equal(graph.errors?.[0]?.extensions?.code,'IMMUTABLE_STATUS_CATEGORY');
    assert.deepEqual(app.repo.raw('statuses',status.id),status);assert.deepEqual(app.repo.raw('issues',issue.id),issue);assert.deepEqual(app.repo.all('activities',state.workspaceId),activities);assert.equal((app.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq,sequence);
    const edit=await fetch(url+'/api/v1/statuses/'+status.id,{method:'PATCH',headers,body:JSON.stringify({description:'Safe metadata edit'})});assert.equal(edit.status,200);assert.equal((await edit.json()).type,status.type);
  }finally{await app.close();}
});
