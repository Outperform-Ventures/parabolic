import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app.ts';
import type {Actor} from '../../src/server/repository.ts';
import {recurringRunAt,nextRecurringDueDate} from '../../src/server/recurring-issues.ts';

test('recurring due dates clamp from each current occurrence and schedule after local midnight across DST',()=>{
 assert.equal(recurringRunAt('2026-03-07','America/New_York'),'2026-03-08T05:01:00.000Z');
 assert.equal(recurringRunAt('2026-03-08','America/New_York'),'2026-03-09T04:01:00.000Z');
 assert.equal(recurringRunAt('2026-10-31','America/New_York'),'2026-11-01T04:01:00.000Z');
 assert.equal(recurringRunAt('2026-11-01','America/New_York'),'2026-11-02T05:01:00.000Z');
 const issue:any={dueDate:'2026-01-31',recurrenceDueDate:'2026-01-31',recurrence:{frequency:'monthly',interval:1}};
 assert.equal(nextRecurringDueDate(issue),'2026-02-28');
 assert.equal(nextRecurringDueDate({...issue,recurrenceDueDate:'2026-02-28'}),'2026-03-28');
});

test('recurring issue conversion, timezone boundary, repeated ticks, cadence edits and cancellation persist',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
  const setup=await app.auth.setup({name:'Owner',email:'recurrence@example.test',password:'test-owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z')};
  const team=repo.all('teams',actor.workspaceId)[0];repo.update(actor,'teams',team.id,{timezone:'America/New_York'});
  const issue=repo.create(actor,'issues',{title:'Monthly close',teamId:team.id,dueDate:'2026-01-31'});
  const converted=repo.update(actor,'issues',issue.id,{recurrence:{frequency:'monthly',interval:1}});
  assert.equal(converted.nextRunAt,'2026-02-01T05:01:00.000Z');assert.equal(converted.recurrence.timeZone,'America/New_York');
  const generated=()=>repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===issue.id);
  app.scheduler.tick(new Date('2026-02-01T05:00:59Z'));assert.equal(generated().length,0);
  app.scheduler.tick(new Date('2026-02-01T05:01:00Z'));assert.equal(generated().length,1);assert.equal(generated()[0].dueDate,'2026-02-28');
  assert.equal(repo.raw('issues',issue.id)!.nextRunAt,'2026-03-01T05:01:00.000Z');
  app.scheduler.tick(new Date('2026-02-01T05:01:00Z'));assert.equal(generated().length,1);
  app.scheduler.tick(new Date('2026-03-01T05:01:00Z'));assert.equal(generated().length,2);assert.equal(generated()[1].dueDate,'2026-03-28');
  repo.update(actor,'issues',issue.id,{dueDate:'2026-04-10',recurrence:{frequency:'weekly',interval:2}});
  assert.equal(repo.raw('issues',issue.id)!.nextRunAt,'2026-04-11T04:01:00.000Z');
  repo.update(actor,'issues',issue.id,{recurrence:null});assert.equal(repo.raw('issues',issue.id)!.nextRunAt,null);
  app.scheduler.tick(new Date('2026-05-01T00:00:00Z'));assert.equal(generated().length,2);
  assert.throws(()=>repo.create(actor,'issues',{title:'Invalid zone',teamId:team.id,dueDate:'2026-04-10',recurrence:{frequency:'daily',timeZone:'bad/zone'}}),(e:any)=>e.status===422);
  assert.throws(()=>repo.create(actor,'issues',{title:'Invalid day',teamId:team.id,dueDate:'2026-02-30',recurrence:{frequency:'daily'}}),(e:any)=>e.status===422);
 }finally{await app.close()}
});

test('recurring occurrences copy the current issue tree independently of later template changes or deletion',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
  const setup=await app.auth.setup({name:'Owner',email:'recurring-template@example.test',password:'owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z')};
  const team=repo.all('teams',actor.workspaceId)[0],statuses=repo.all('statuses',actor.workspaceId),done=statuses.find(s=>s.teamId===team.id&&s.type==='completed')!;
  const template=repo.create(actor,'templates',{name:'Checklist',type:'issue',properties:{title:'Monthly checklist',priority:2,description:'Original checklist'},subIssues:[{title:'Collect figures',subIssues:[{title:'Check totals'}]},{title:'Publish report'}]});
  const source=repo.create(actor,'issues',{teamId:team.id,templateId:template.id,dueDate:'2026-01-31',recurrence:{frequency:'monthly'}});
  const children=repo.all('issues',actor.workspaceId).filter(i=>i.parentId===source.id),collect=children.find(i=>i.title==='Collect figures')!;
  repo.update(actor,'issues',collect.id,{title:'Collect approved figures',statusId:done.id,estimate:3});
  repo.update(actor,'issues',source.id,{description:'Edited series instructions'});
  repo.update(actor,'templates',template.id,{properties:{title:'Changed template',priority:1,description:'Changed instructions'},subIssues:[{title:'Unrelated new child'}]});
  app.scheduler.tick(new Date('2026-02-01T00:01:00Z'));
  const generated=()=>repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===source.id);
  const first=generated()[0];assert.ok(first);assert.equal(first.title,source.title);assert.equal(first.description,'Edited series instructions');assert.equal(first.priority,2);assert.equal(first.templateId,null);assert.equal(first.dueDate,'2026-02-28');
  const clonedChildren=repo.all('issues',actor.workspaceId).filter(i=>i.parentId===first.id);assert.equal(clonedChildren.length,2);
  const copied=clonedChildren.find(i=>i.title==='Collect approved figures')!;assert.ok(copied);assert.equal(copied.estimate,3);assert.equal(repo.raw('statuses',copied.statusId)!.type,'unstarted');assert.equal(copied.templateId,null);assert.equal(copied.recurrence,undefined);
  assert.equal(repo.all('issues',actor.workspaceId).filter(i=>i.parentId===copied.id&&i.title==='Check totals').length,1);
  assert.equal(repo.raw('issues',collect.id)!.statusId,done.id);assert.equal(repo.all('issues',actor.workspaceId).some(i=>i.title==='Unrelated new child'),false);
  repo.remove(actor,'templates',template.id);
  app.scheduler.tick(new Date('2026-03-01T00:01:00Z'));assert.equal(generated().length,2);
  const second=generated().find(i=>i.id!==first.id)!;assert.equal(second.dueDate,'2026-03-28');assert.equal(repo.all('issues',actor.workspaceId).filter(i=>i.parentId===second.id).length,2);
  app.scheduler.tick(new Date('2026-03-01T00:01:00Z'));assert.equal(generated().length,2);
 }finally{await app.close()}
});

test('calendar schedule edits do not replay elapsed dates and changed due dates replace the monthly anchor',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'recurrence-edits@example.test',password:'owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z')},team=repo.all('teams',actor.workspaceId)[0];
  const source=repo.create(actor,'issues',{title:'Date edits',teamId:team.id,recurrence:{frequency:'monthly',startDate:'2026-01-31'}});assert.equal(source.dueDate,'2026-01-31');
  app.scheduler.tick(new Date('2026-02-01T00:01:00Z'));const scheduled=repo.raw('issues',source.id)!;assert.equal(scheduled.recurrenceDueDate,'2026-02-28');
  const unchanged=repo.update(actor,'issues',source.id,{title:'Renamed',dueDate:scheduled.dueDate,recurrence:{...scheduled.recurrence}});assert.equal(unchanged.nextRunAt,scheduled.nextRunAt);assert.equal(unchanged.recurrenceDueDate,'2026-02-28');
  app.scheduler.tick(new Date('2026-02-01T00:02:00Z'));assert.equal(repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===source.id).length,1);
  const cadence=repo.update(actor,'issues',source.id,{recurrence:{...unchanged.recurrence,interval:2}});assert.equal(cadence.recurrenceDueDate,'2026-02-28');assert.equal(cadence.nextRunAt,'2026-03-01T00:01:00.000Z');
  const moved=repo.update(actor,'issues',source.id,{dueDate:'2026-04-15'});assert.equal(moved.recurrence.startDate,'2026-04-15');assert.equal(nextRecurringDueDate(moved),'2026-06-15');
  const start=repo.update(actor,'issues',source.id,{recurrence:{...moved.recurrence,startDate:'2026-05-20'}});assert.equal(start.dueDate,'2026-05-20');assert.equal(start.nextRunAt,'2026-05-21T00:01:00.000Z');assert.equal(nextRecurringDueDate(start),'2026-07-20');
 }finally{await app.close()}
});

test('invalid recurrence payloads and forged scheduler fields are rejected atomically',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'recurrence-validation@example.test',password:'owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z')},team=repo.all('teams',actor.workspaceId)[0];
  const source=repo.create(actor,'issues',{title:'Valid recurrence',teamId:team.id,dueDate:'2026-01-31',recurrence:{frequency:'monthly'}}),snapshot=structuredClone(source),before=repo.all('issues',actor.workspaceId).length;
  const invalid:any[]=[false,'weekly',[],{frequency:'hourly'},...[0,-1,1.5,366,null,'2'].map(interval=>({frequency:'weekly',interval})),...[0,-2,1.5,32,null,'20'].map(dayOfMonth=>({frequency:'monthly',dayOfMonth})),...['bad','2026-02-30',null,10].map(startDate=>({frequency:'monthly',startDate})),...['bad/zone','',null,10].map(timeZone=>({frequency:'monthly',timeZone}))];
  for(const recurrence of invalid){assert.throws(()=>repo.create(actor,'issues',{title:'Invalid recurrence',teamId:team.id,dueDate:'2026-01-31',recurrence}),(e:any)=>e.status===422);assert.throws(()=>repo.update(actor,'issues',source.id,{title:'Must roll back',recurrence}),(e:any)=>e.status===422);assert.deepEqual(repo.raw('issues',source.id),snapshot);}
  for(const field of ['nextRunAt','recurrenceDueDate','recurrenceSourceId']){assert.throws(()=>repo.update(actor,'issues',source.id,{[field]:'2026-01-01'}),(e:any)=>e.code==='INVALID_RECURRENCE_SCHEDULE');assert.throws(()=>repo.create(actor,'issues',{title:'Forged schedule',teamId:team.id,[field]:'2026-01-01'}),(e:any)=>e.code==='INVALID_RECURRENCE_SCHEDULE');}
  assert.equal(repo.all('issues',actor.workspaceId).length,before);app.scheduler.tick(new Date('2026-02-01T00:01:00Z'));assert.equal(repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===source.id).length,1);
 }finally{await app.close()}
});

test('delayed recurring ticks keep the generated due date aligned with the schedule cursor',async()=>{
 const app=createApp({databasePath:':memory:',port:0});
 try{
  const setup=await app.auth.setup({name:'Owner',email:'recurrence-catchup@example.test',password:'test-owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T12:00:00Z')};
  const team=repo.all('teams',actor.workspaceId)[0];
  const source=repo.create(actor,'issues',{title:'Monthly close after downtime',teamId:team.id,dueDate:'2026-01-31',recurrence:{frequency:'monthly',timeZone:'America/New_York'}});
  const generated=()=>repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===source.id);
  app.scheduler.tick(new Date('2026-04-10T12:00:00Z'));
  assert.equal(generated().length,1);
  assert.equal(generated()[0].dueDate,'2026-04-28');
  assert.equal(repo.raw('issues',source.id)!.recurrenceDueDate,generated()[0].dueDate);
  assert.equal(repo.raw('issues',source.id)!.nextRunAt,'2026-04-29T04:01:00.000Z');
  app.scheduler.tick(new Date('2026-04-10T12:00:00Z'));assert.equal(generated().length,1);
  app.scheduler.tick(new Date('2026-05-01T04:01:00Z'));
  assert.deepEqual(generated().map(i=>i.dueDate).sort(),['2026-04-28','2026-05-28']);
 }finally{await app.close()}
});


test('yearly recurrence clamps current day across common years and supports multi-year intervals',async()=>{
 const issue:any={dueDate:'2024-02-29',recurrenceDueDate:'2024-02-29',recurrence:{frequency:'yearly',interval:1,startDate:'2024-02-29'}};
 for(const [from,to] of [['2024-02-29','2025-02-28'],['2025-02-28','2026-02-28'],['2027-02-28','2028-02-28']])assert.equal(nextRecurringDueDate({...issue,recurrenceDueDate:from}),to);
 assert.equal(nextRecurringDueDate({...issue,recurrence:{...issue.recurrence,interval:4}}),'2028-02-29');
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'yearly@example.test',password:'owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2024-01-01T12:00:00Z')},team=repo.all('teams',actor.workspaceId)[0];
  const source=repo.create(actor,'issues',{title:'Annual review',teamId:team.id,dueDate:'2024-02-29',recurrence:{frequency:'yearly',timeZone:'America/New_York'}});
  app.scheduler.tick(new Date('2024-03-01T05:01:00Z'));
  const generated=()=>repo.all('issues',actor.workspaceId).filter(i=>i.recurrenceSourceId===source.id);
  assert.equal(generated().length,1);assert.equal(generated()[0].dueDate,'2025-02-28');assert.equal(repo.raw('issues',source.id)!.nextRunAt,'2025-03-01T05:01:00.000Z');
  app.scheduler.tick(new Date('2024-03-01T05:01:00Z'));assert.equal(generated().length,1);
 }finally{await app.close()}
});

test('recurring series and generated instances select their due-date cycle instead of copying the old cycle',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'recurrence-cycles@example.test',password:'owner-password'}),repo=app.repo;
  const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-03-02T12:00:00Z')},team=repo.create(actor,'teams',{name:'Recurring calendar',key:'RCL',cyclesEnabled:true,cycleDuration:1,cycleStartDay:1,cycleCooldownDays:0,cycleUpcomingCount:4,timezone:'America/New_York'});
  const cycles=repo.all('cycles',actor.workspaceId).filter(c=>c.teamId===team.id).sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate));
  const source=repo.create(actor,'issues',{title:'Weekly recurring review',teamId:team.id,dueDate:'2026-03-08',recurrence:{frequency:'weekly'}});
  assert.equal(source.cycleId,cycles[0].id);
  const explicit=repo.create(actor,'issues',{title:'Explicit no cycle',teamId:team.id,dueDate:'2026-03-15',cycleId:null,recurrence:{frequency:'weekly'}});assert.equal(explicit.cycleId,null);
  app.scheduler.tick(new Date('2026-03-09T04:01:00Z'));
  const occurrence=repo.all('issues',actor.workspaceId).find(i=>i.recurrenceSourceId===source.id)!;
  assert.equal(occurrence.dueDate,'2026-03-15');assert.equal(occurrence.cycleId,cycles[1].id);
  const future=repo.create(actor,'issues',{title:'Future due',teamId:team.id,dueDate:'2026-03-23',recurrence:{frequency:'weekly'}});assert.equal(future.cycleId,cycles[3].id);
  const distant=repo.create(actor,'issues',{title:'No generated cycle yet',teamId:team.id,dueDate:'2028-03-23',recurrence:{frequency:'yearly'}});assert.ok(!distant.cycleId);
 }finally{await app.close()}
});
