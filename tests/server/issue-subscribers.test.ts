import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';import {Repository,type Actor} from '../../src/server/repository';

test('effective issue subscribers follow record lifecycle, immutable sources and sync without changing issue edit time',async()=>{
 const app=createApp({databasePath:':memory:',port:0});await app.start();try{
 const setup=await app.auth.setup({name:'Owner',email:'subscribers@example.test',password:'owner-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
 const a=repo.create(actor,'issues',{title:'First subscribed',teamId:team.id}),b=repo.create(actor,'issues',{title:'Second subscribed',teamId:team.id});
 repo.update(actor,'issues',a.id,{subscriberIds:[]});repo.update(actor,'issues',b.id,{subscriberIds:[]});
 const old=repo.raw('issues',a.id)!,seq=Number((repo.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq);
 const one=repo.create(actor,'subscriptions',{issueId:a.id}),two=repo.create(actor,'subscriptions',{entityKind:'issues',entityId:a.id});
 assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[actor.userId]);assert.deepEqual(repo.raw('issues',a.id)!.subscriptionUserIds,[actor.userId]);assert.equal(repo.raw('issues',a.id)!.updatedAt,old.updatedAt);
 const filter={match:'all',conditions:[{field:'subscribers',operator:'eq',value:actor.userId}]};assert.deepEqual(repo.list(actor,'issues',{filter}).nodes.map(i=>i.id),[a.id]);
 assert.ok((repo.db.prepare("SELECT data FROM changes WHERE kind='issues' AND seq>? AND entity_id=?").all(seq,a.id) as any[]).some(row=>JSON.parse(row.data).subscribers.includes(actor.userId)));
 repo.remove(actor,'subscriptions',one.id);assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[actor.userId]);
 repo.update(actor,'subscriptions',two.id,{entityId:b.id});assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[]);assert.deepEqual(repo.raw('issues',b.id)!.subscribers,[actor.userId]);
 repo.restore(actor,'subscriptions',one.id);assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[actor.userId]);
 repo.update(actor,'issues',a.id,{subscribers:[],subscriptionUserIds:[]});assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[actor.userId]);
 repo.remove(actor,'subscriptions',one.id);const comment=repo.create(actor,'comments',{issueId:a.id,body:'Thread only'});repo.create(actor,'subscriptions',{entityKind:'comments',entityId:comment.id});assert.deepEqual(repo.raw('issues',a.id)!.subscribers,[]);
 // Simulate a database from before materialization; startup reconciles caches once.
 repo.db.prepare("DELETE FROM data_migrations WHERE name='issue-subscribers-v1'").run();repo.db.prepare("UPDATE entities SET data=json_remove(data,'$.subscribers','$.subscriptionUserIds') WHERE kind='issues'").run();
 const before=repo.raw('issues',b.id)!;new Repository(repo.db);assert.deepEqual(repo.raw('issues',b.id)!.subscribers,[actor.userId]);assert.equal(repo.raw('issues',b.id)!.version,before.version+1);new Repository(repo.db);assert.equal(repo.raw('issues',b.id)!.version,before.version+1);
 }finally{await app.close()}
});

test('routing and SLA subscriber conditions see automatic creation, reassignment and current subscription sources',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'subscriber-rules@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2027-01-01T00:00:00Z')};
 const team=repo.all('teams',actor.workspaceId)[0];repo.update(actor,'teams',team.id,{triageEnabled:true});const statusId=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type==='triage')!.id;
 const filter=(operator:string)=>({match:'all',conditions:[{field:'subscribers',operator,value:actor.userId}]});
 repo.create(actor,'automations',{name:'Followed routing',type:'routing',teamId:team.id,filter:filter('eq'),set:{priority:1}});
 repo.create(actor,'automations',{name:'Unfollowed routing',type:'routing',teamId:team.id,filter:filter('neq'),set:{priority:3}});
 const policy=repo.create(actor,'slaPolicies',{name:'Followed SLA',teamId:team.id,action:'apply',duration:2,durationUnit:'hour',filter:filter('eq')});repo.create(actor,'slaPolicies',{name:'Unfollowed SLA',teamId:team.id,action:'remove',filter:filter('neq')});
 const created=repo.create(actor,'issues',{title:'Automatically followed creator',teamId:team.id,statusId});assert.equal(created.priority,1);assert.equal(created.slaPolicyId,policy.id);
 const removed=repo.update(actor,'issues',created.id,{subscriberIds:[],title:'Unfollowed by creator'});assert.equal(removed.priority,3);assert.equal(removed.slaPolicyId,null);
 const record=repo.create(actor,'subscriptions',{issueId:created.id});const followed=repo.update(actor,'issues',created.id,{title:'Followed through record'});assert.equal(followed.priority,1);assert.equal(followed.slaPolicyId,policy.id);
 repo.remove(actor,'subscriptions',record.id);const assigned=repo.update(actor,'issues',created.id,{assigneeId:actor.userId,title:'Followed through assignment'});assert.equal(assigned.priority,1);assert.equal(assigned.slaPolicyId,policy.id);
 const explicitlyUnfollowed=repo.update(actor,'issues',created.id,{subscriberIds:[],title:'Unfollowed despite unchanged assignee'});assert.equal(explicitlyUnfollowed.priority,3);assert.equal(explicitlyUnfollowed.slaPolicyId,null);assert.deepEqual(explicitlyUnfollowed.subscribers,[]);
 }finally{await app.close()}
});

test('explicit subscriber selection removes other users issue records atomically without exposing private records',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();try{
 const setup=await app.auth.setup({name:'Owner',email:'manage-subs@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};
 const invitation=await(await fetch(url+'/api/v1/invitations',{method:'POST',headers:{cookie:'parabolic_session='+setup.token,'content-type':'application/json'},body:JSON.stringify({email:'record-subscriber@example.test'})})).json();
 const joined=await(await fetch(url+'/auth/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invitation.token,name:'Record subscriber',password:'member-password'})})).json();
 const member:Actor={...actor,userId:joined.user.id,role:'member',scopes:['read','write']},team=repo.all('teams',actor.workspaceId)[0],issue=repo.create(actor,'issues',{title:'Managed subscribers',teamId:team.id}),other=repo.create(actor,'issues',{title:'Unrelated subscription',teamId:team.id});
 const one=repo.create(member,'subscriptions',{issueId:issue.id}),two=repo.create(member,'subscriptions',{entityKind:'issues',entityId:issue.id}),unrelated=repo.create(member,'subscriptions',{issueId:other.id});
 const comment=repo.create(actor,'comments',{issueId:issue.id,body:'Keep thread subscription'}),thread=repo.create(member,'subscriptions',{entityKind:'comments',entityId:comment.id});
 assert.throws(()=>repo.get(actor,'subscriptions',one.id));
 const before=repo.raw('issues',issue.id)!;assert.throws(()=>repo.update(actor,'issues',issue.id,{replaceSubscribers:true,subscribers:['missing-user']}));assert.equal(repo.raw('issues',issue.id)!.version,before.version);assert.ok(repo.raw('subscriptions',one.id));
 const selected=repo.update(actor,'issues',issue.id,{version:before.version,replaceSubscribers:true,subscribers:[actor.userId]});assert.deepEqual(selected.subscribers,[actor.userId]);assert.equal(selected.version,before.version+1);assert.equal(selected.replaceSubscribers,undefined);assert.equal(repo.raw('subscriptions',one.id),null);assert.equal(repo.raw('subscriptions',two.id),null);assert.ok(repo.raw('subscriptions',thread.id));assert.ok(repo.raw('subscriptions',unrelated.id));
 assert.throws(()=>repo.update(actor,'issues',issue.id,{version:before.version,replaceSubscribers:true,subscribers:[]}));assert.deepEqual(repo.raw('issues',issue.id)!.subscribers,[actor.userId]);
 const added=repo.update(actor,'issues',issue.id,{replaceSubscribers:true,subscribers:[member.userId,member.userId]});assert.deepEqual(added.subscribers,[member.userId]);assert.deepEqual(added.subscriberIds,[member.userId]);
 const response=await fetch(url+'/api/v1/issues/'+issue.id,{method:'PATCH',headers:{cookie:'parabolic_session='+setup.token,'content-type':'application/json'},body:JSON.stringify({replaceSubscribers:true,subscribers:[]})});assert.equal(response.status,200);assert.deepEqual((await response.json()).subscribers,[]);
 const secretTeam=repo.create(actor,'teams',{name:'Secret subscribers',key:'SEC',private:true}),secret=repo.create(actor,'issues',{title:'Not shared',teamId:secretTeam.id});assert.throws(()=>repo.update(actor,'issues',secret.id,{replaceSubscribers:true,subscribers:[member.userId]}));assert.throws(()=>repo.update(member,'issues',secret.id,{replaceSubscribers:true,subscribers:[]}));
 }finally{await app.close()}
});
