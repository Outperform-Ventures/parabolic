import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';import {matchesFilter} from '../../src/client/query';import {statusTimeFields,parseStatusDuration,statusDurationCondition,statusTimeFromHistory} from '../../src/shared/issue-status-time';
test('status duration accumulates across repeated visits, survives edits, and agrees in saved queries',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Status Time',email:'time@example.test',password:'status-password'}),repo=app.repo;
 const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z'),timeZone:'UTC'};
 const team=repo.all('teams',actor.workspaceId)[0],statuses=repo.all('statuses',actor.workspaceId),todo=statuses.find(s=>s.teamId===team.id&&s.type==='unstarted')!,started=statuses.find(s=>s.teamId===team.id&&s.type==='started')!;
 const issue=repo.create(actor,'issues',{title:'Visits',teamId:team.id,statusId:todo.id,statusEnteredAt:'1900-01-01'});assert.equal(issue.statusEnteredAt,'2026-01-01T12:00:00.000Z');
 const at=(day:number)=>({...actor,now:new Date(`2026-01-0${day}T12:00:00Z`)});
 repo.update(at(3),'issues',issue.id,{statusId:started.id});const returned=repo.update(at(4),'issues',issue.id,{statusId:todo.id});assert.equal(returned.statusTimeTotals[todo.id],2*86400000);assert.equal(returned.accumulatedStateUpdatedAt,'2026-01-02T12:00:00.000Z');
 const edited=repo.update(at(5),'issues',issue.id,{title:'Edited',accumulatedStateUpdatedAt:'1900-01-01'});assert.equal(edited.accumulatedStateUpdatedAt,returned.accumulatedStateUpdatedAt);
 const filter={match:'all' as const,conditions:[statusDurationCondition('P3D')]};assert.equal(matchesFilter(edited,filter,undefined,undefined,undefined,{now:at(5).now,timeZone:'UTC'}),true);assert.equal(repo.list(at(5),'issues',{filter}).totalCount,1);assert.equal(repo.list(at(4),'issues',{filter}).totalCount,0);
 const inverse={match:'all',conditions:[{...filter.conditions[0],operator:'gt'}]};assert.equal(repo.list(at(5),'issues',{filter:inverse}).totalCount,0);
 const activities=repo.all('activities',actor.workspaceId).filter(a=>a.entityId===issue.id);assert.ok(activities.every(a=>statusTimeFields.every(field=>!a.changes?.[field])));
 assert.equal(statusTimeFromHistory(edited,activities)?.accumulatedStateUpdatedAt,edited.accumulatedStateUpdatedAt);
 const legacy={...edited};for(const field of statusTimeFields)delete legacy[field];repo.db.prepare('UPDATE entities SET data=? WHERE id=?').run(JSON.stringify(legacy),issue.id);assert.equal(repo.list(at(5),'issues',{filter}).totalCount,1);
 repo.db.prepare("DELETE FROM entities WHERE kind='activities' AND json_extract(data,'$.entityId')=?").run(issue.id);
 const incomplete=repo.update(at(6),'issues',issue.id,{statusId:started.id});assert.equal(incomplete.statusTimeComplete,false);assert.equal(incomplete.accumulatedStateUpdatedAt,null);
 assert.equal(repo.update(at(7),'issues',issue.id,{title:'Unknown historical time'}).accumulatedStateUpdatedAt,null);
 }finally{await app.close()}
});
test('custom status durations parse units and reject invalid or unbounded values',()=>{
 assert.deepEqual(parseStatusDuration('2 days'),{id:'P2D',name:'2 days'});assert.deepEqual(parseStatusDuration('3 weeks'),{id:'P3W',name:'3 weeks'});assert.deepEqual(parseStatusDuration('1 hour'),{id:'PT1H',name:'1 hour'});
 for(const text of ['0 days','-2 days','2.5 days','999999 days','yesterday',''])assert.equal(parseStatusDuration(text),null);
});
