import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';

test('team moves remap compatible labels/statuses, preserve shared projects and priority, and clear unavailable properties',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'move@example.test',name:'Owner',password:'move-owner-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo,source=repo.all('teams',actor.workspaceId)[0],dest=repo.create(actor,'teams',{name:'Destination',key:'DST',memberIds:[actor.userId],triageEnabled:true});
  const oldStatus=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===source.id&&s.type==='started')!,newStatus=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===dest.id&&s.type==='started')!;
  const global=repo.create(actor,'labels',{name:'Global'}),old=repo.create(actor,'labels',{name:'Bug',teamId:source.id}),mapped=repo.create(actor,'labels',{name:'Bug',teamId:dest.id}),lost=repo.create(actor,'labels',{name:'Source only',teamId:source.id}),shared=repo.create(actor,'projects',{name:'Shared',teamIds:[source.id,dest.id]}),exclusive=repo.create(actor,'projects',{name:'Exclusive',teamIds:[source.id]});
  const issue=repo.create(actor,'issues',{teamId:source.id,title:'Mapped',statusId:oldStatus.id,priority:1,labelIds:[global.id,old.id,lost.id],projectId:shared.id});
  const moved=repo.update(actor,'issues',issue.id,{teamId:dest.id});assert.equal(moved.statusId,newStatus.id);assert.equal(moved.priority,1);assert.equal(moved.projectId,shared.id);assert.deepEqual(moved.labelIds,[global.id,mapped.id]);assert.ok(moved.previousIdentifiers.includes(issue.identifier));
  const second=repo.create(actor,'issues',{teamId:source.id,title:'Remove unavailable project',projectId:exclusive.id});assert.equal(repo.update(actor,'issues',second.id,{teamId:dest.id}).projectId,null);
 }finally{await app.close()}
});

test('outsider team moves send open issues to triage and preserve closed workflow categories',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'incoming@example.test',name:'Owner',password:'incoming-owner-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo,source=repo.all('teams',actor.workspaceId)[0],dest=repo.create(actor,'teams',{name:'Intake',key:'IN',memberIds:[],ownerId:null,triageEnabled:true});
  // Remove creator membership so the actor is explicitly outside the destination team.
  repo.update(actor,'teams',dest.id,{memberIds:[],ownerId:null,ownerIds:[]});
  for(const category of ['started','completed','canceled']){
   const status=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===source.id&&s.type===category)!,issue=repo.create(actor,'issues',{teamId:source.id,title:category,statusId:status.id}),moved=repo.update(actor,'issues',issue.id,{teamId:dest.id});
   assert.equal(repo.raw('statuses',moved.statusId)?.type,category==='started'?'triage':category);
  }
 }finally{await app.close()}
});

test('an explicit destination cycle survives a move and the original cycle can be restored by undo fields',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'cycle-move@example.test',name:'Owner',password:'cycle-move-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo,source=repo.all('teams',actor.workspaceId)[0],dest=repo.create(actor,'teams',{name:'Cycle destination',key:'CYC',memberIds:[actor.userId]});
  const cycle=(teamId:string,name:string)=>repo.create(actor,'cycles',{teamId,name,startDate:'2030-01-01',endDate:'2030-01-15'}),first=cycle(source.id,'Source cycle'),second=cycle(dest.id,'Destination cycle'),status=(teamId:string)=>repo.all('statuses',actor.workspaceId).find(s=>s.teamId===teamId&&s.type==='unstarted')!.id;
  const issue=repo.create(actor,'issues',{title:'Move with selected cycle',teamId:source.id,statusId:status(source.id),cycleId:first.id});
  const moved=repo.update(actor,'issues',issue.id,{teamId:dest.id,statusId:status(dest.id),cycleId:second.id});assert.equal(moved.cycleId,second.id);
  const restored=repo.update(actor,'issues',issue.id,{teamId:source.id,statusId:status(source.id),cycleId:first.id});assert.equal(restored.cycleId,first.id);
  assert.throws(()=>repo.update(actor,'issues',issue.id,{teamId:dest.id,statusId:status(dest.id),cycleId:first.id}),/Cycle belongs/);assert.equal(repo.raw('issues',issue.id)?.teamId,source.id);
 }finally{await app.close()}
});
