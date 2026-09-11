import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type{Actor}from '../../src/server/repository';import {matchesFilter}from '../../src/client/query';import{issueDateFields,issueDatePresets}from '../../src/shared/issue-date-presets';
test('every historical quick-date predicate agrees between client and persisted query and remains relative',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({name:'Date owner',email:'date-fixture@example.test',password:'date-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-09-08T12:00:00Z'),timeZone:'UTC'},team=repo.all('teams',actor.workspaceId)[0];
 const recent=repo.create(actor,'issues',{title:'Recent',teamId:team.id}),old=repo.create(actor,'issues',{title:'Old',teamId:team.id});
 // Backdated test fixtures model imported history; these assignments do not claim transition timestamp support.
 for(const [field]of issueDateFields.filter(([field])=>field!=='dueDate')){
  const rows=[{...recent,[field]:'2026-09-08T11:00:00.000Z'},{...old,[field]:'2026-09-01T11:00:00.000Z'}];for(const row of rows)repo.db.prepare('UPDATE entities SET data=? WHERE id=?').run(JSON.stringify(row),row.id);
  const condition=issueDatePresets(field).find(p=>p.id==='P1D')!.condition,filter={match:'all' as const,conditions:[condition]};
  assert.deepEqual(rows.filter(row=>matchesFilter(row,filter,undefined,undefined,undefined,{now:actor.now,timeZone:'UTC'})).map(row=>row.id),[recent.id],field);
  assert.deepEqual(repo.list(actor,'issues',{filter}).nodes.map(row=>row.id),[recent.id],field);assert.equal(condition.value,'-P1D');
  assert.equal(repo.list({...actor,now:new Date('2026-09-10T12:00:00Z')},'issues',{filter}).totalCount,0,field);
 }
 }finally{await app.close()}
});
test('issue transitions record dates used by started and triaged filters',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({name:'Transitions',email:'transition-dates@example.test',password:'date-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-09-08T10:00:00Z')},team=repo.all('teams',actor.workspaceId)[0];
 repo.update(actor,'teams',team.id,{triageEnabled:true});const statuses=repo.all('statuses',actor.workspaceId).filter(s=>s.teamId===team.id),started=statuses.find(s=>s.type==='started')!,unstarted=statuses.find(s=>s.type==='unstarted')!,triage=statuses.find(s=>s.type==='triage')!;
 const issue=repo.create(actor,'issues',{title:'Transition',teamId:team.id,statusId:triage.id});assert.equal(issue.triagedAt??null,null);
 const accepted=repo.update(actor,'issues',issue.id,{statusId:unstarted.id});assert.equal(accepted.triagedAt,actor.now!.toISOString());
 const later={...actor,now:new Date('2026-09-08T11:00:00Z')},working=repo.update(later,'issues',issue.id,{statusId:started.id});assert.equal(working.startedAt,later.now.toISOString());
 const edited=repo.update({...later,now:new Date('2026-09-08T12:00:00Z')},'issues',issue.id,{title:'Renamed'});assert.equal(edited.startedAt,working.startedAt);assert.equal(edited.triagedAt,accepted.triagedAt);
 assert.equal(repo.create(later,'issues',{title:'Already in progress',teamId:team.id,statusId:started.id}).startedAt,later.now.toISOString());
 assert.equal(repo.list(later,'issues',{filter:{match:'all',conditions:[{field:'triagedAt',operator:'gte',value:'-P1D'}]}}).totalCount,1);
 }finally{await app.close()}
});
