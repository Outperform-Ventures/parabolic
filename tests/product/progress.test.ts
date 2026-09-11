import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressHistory,projectGraphAvailable} from '../../src/client/features/progress-data.ts';
import type {Entity} from '../../src/shared/types.ts';
const e=(fields:Record<string,any>):Entity=>({id:'x',workspaceId:'w',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...fields});
const statuses=[e({id:'todo',type:'unstarted'}),e({id:'started',type:'started'}),e({id:'done',type:'completed'}),e({id:'canceled',type:'canceled'})];
const event=(time:string,changes:Record<string,any>,action='update')=>e({id:time,createdAt:time,entityKind:'issues',entityId:'issue',action,changes});
test('project graph lifecycle uses status categories and retains graphs after a started project pauses or completes',()=>{
 const category=(status:string)=>({customPlanned:'planned',customActive:'started',customDone:'completed',customCanceled:'canceled'}[status]||status),project=e({id:'project',status:'customPlanned'});
 assert.equal(projectGraphAvailable(project,[],category),false);
 assert.equal(projectGraphAvailable({...project,status:'customActive'},[],category),true);
 assert.equal(projectGraphAvailable({...project,status:'customDone'},[],category),true);
 assert.equal(projectGraphAvailable({...project,status:'customCanceled'},[],category),false);
 const history=[e({entityKind:'projects',entityId:'project',changes:{status:{from:'customActive',to:'customPlanned'}}})];
 assert.equal(projectGraphAvailable(project,history,category),true);
 assert.equal(projectGraphAvailable(project,history.map(event=>({...event,entityId:'other'})),category),false);
});
test('progress replays membership, estimates, status changes and removal instead of counting present-day issues in the past',()=>{
  const issue=e({id:'issue',projectId:'other',teamId:'team',statusId:'done',estimate:5});
  const activities=[event('2026-01-02T00:00:00Z',{projectId:{from:null,to:'project'}}),event('2026-01-03T00:00:00Z',{estimate:{from:2,to:5},statusId:{from:'todo',to:'started'}}),event('2026-01-08T00:00:00Z',{statusId:{from:'started',to:'done'}}),event('2026-01-10T00:00:00Z',{projectId:{from:'project',to:'other'}})];
  const input={collection:e({id:'project'}),kind:'project' as const,issues:[issue],activities,statuses,teams:[]};
  assert.equal(buildProgressHistory({...input,now:Date.parse('2026-01-01T12:00:00Z')}).scope,0);
  let graph=buildProgressHistory({...input,now:Date.parse('2026-01-02T12:00:00Z')});assert.equal(graph.scope,2);assert.equal(graph.started,0);
  graph=buildProgressHistory({...input,now:Date.parse('2026-01-04T12:00:00Z')});assert.equal(graph.scope,5);assert.equal(graph.started,5);assert.equal(graph.completed,0);
  graph=buildProgressHistory({...input,now:Date.parse('2026-01-09T12:00:00Z')});assert.equal(graph.completed,5);
  assert.equal(buildProgressHistory({...input,now:Date.parse('2026-01-11T00:00:00Z')}).scope,0);
});
test('deleted work contributes before deletion and canceled issues do not inflate remaining scope',()=>{
  const issue=e({id:'issue',projectId:'project',statusId:'done',estimate:3,deletedAt:'2026-01-09T00:00:00Z'});
  const input={collection:e({id:'project'}),kind:'project' as const,issues:[issue,e({id:'canceledIssue',projectId:'project',statusId:'canceled',estimate:8})],activities:[event('2026-01-09T00:00:00Z',{},'delete')],statuses,teams:[]};
  assert.equal(buildProgressHistory({...input,now:Date.parse('2026-01-08T00:00:00Z')}).completed,3);
  assert.equal(buildProgressHistory({...input,now:Date.parse('2026-01-10T00:00:00Z')}).scope,0);
});
test('cycle target pauses on weekends and estimate-off teams use issue count',()=>{
  const graph=buildProgressHistory({collection:e({id:'cycle',startDate:'2026-01-02',endDate:'2026-01-09'}),kind:'cycle',issues:[e({id:'issue',cycleId:'cycle',teamId:'team',statusId:'todo',estimate:8})],activities:[],statuses,teams:[e({id:'team',estimateScale:'None'})],now:Date.parse('2026-01-02T00:00:00Z')});
  assert.equal(graph.scope,1);assert.equal(graph.target.find(p=>new Date(p.time).getUTCDay()===6)?.value,0);assert.equal(graph.target.find(p=>new Date(p.time).getUTCDay()===0)?.value,0);assert.equal(graph.target.at(-1)?.value,1);assert.equal(graph.prediction,undefined);
});

test('completed cycle progress and totals remain frozen after live issue edits',()=>{
 const collection={id:'cycle',startDate:'2026-09-01',endDate:'2026-09-08',createdAt:'2026-08-01',completionSnapshot:{scope:8,started:3,completed:5,issueCount:2,startedIssueCount:1,completedIssueCount:1},progressHistory:[{at:'2026-09-01',scope:8,started:3,completed:0,issueCount:2,startedIssueCount:1,completedIssueCount:0},{at:'2026-09-07',scope:8,started:3,completed:5,issueCount:2,startedIssueCount:1,completedIssueCount:1}]} as any;
 const input={collection,kind:'cycle' as const,issues:[],activities:[],statuses:[],teams:[],now:Date.parse('2026-09-20')};
 const points=buildProgressHistory(input);assert.equal(points.scope,8);assert.equal(points.completed,5);assert.equal(points.points.at(-1)!.scope,8);
 const counts=buildProgressHistory({...input,unit:'issues'});assert.equal(counts.scope,2);assert.equal(counts.completed,1);
});

test('project predictions credit started effort at one quarter and use native forecast bounds',()=>{
 const now=Date.parse('2026-01-15T00:00:00Z'),week=7*86400000,collection=e({id:'project',status:'started',completedScopeHistory:[2,8],issueCountHistory:[2,4]});
 const issues=[e({id:'done',projectId:'project',statusId:'done',estimate:8}),e({id:'remaining',projectId:'project',statusId:'todo',estimate:4}),e({id:'underway',projectId:'project',statusId:'started',estimate:4})];
 const input={collection,kind:'project' as const,issues,activities:[],statuses,teams:[],now};
 const prediction=buildProgressHistory(input).prediction!;assert.equal(prediction.weeklyVelocity,4);
 assert.equal(prediction.date-now,12*86400000);assert.equal(prediction.optimistic-now,7*86400000);assert.equal(prediction.pessimistic-now,16*86400000);
 const unstarted=buildProgressHistory({...input,issues:issues.map(issue=>issue.id==='underway'?{...issue,statusId:'todo'}:issue)}).prediction!;assert.ok(unstarted.date>prediction.date);
 assert.equal(buildProgressHistory({...input,collection:{...collection,status:'planned'}}).predictionState,'notStarted');
 assert.equal(buildProgressHistory({...input,collection:{...collection,issueCountHistory:[]}}).predictionState,'tooEarly');
 const custom={...collection,status:'active-custom'};assert.ok(buildProgressHistory({...input,collection:custom,workspaces:[e({id:'w',projectStatuses:[{id:'active-custom',type:'started'}]})]}).prediction);
 const fresh={...collection,completedScopeHistory:undefined,issueCountHistory:undefined};assert.equal(buildProgressHistory({...input,collection:fresh,now:Date.parse('2026-01-07T23:59:59Z')}).predictionState,'tooEarly');
});

test('imported project progress samples actual creation and completion boundaries instead of a weekly endpoint ramp',()=>{
 const created='2026-09-05T08:00:00Z',completed='2026-09-05T12:00:00Z';
 const graph=buildProgressHistory({collection:e({id:'project',createdAt:'2026-09-04T00:00:00Z'}),kind:'project',issues:[e({id:'imported',createdAt:created,projectId:'project',statusId:'done',estimate:54,completedAt:completed})],activities:[],statuses,teams:[],now:Date.parse('2026-09-07T12:00:00Z')});
 const at=(time:string)=>graph.points.find(point=>point.time===Date.parse(time))!;
 assert.equal(at(created).scope,54);assert.equal(at(created).completed,0);assert.equal(at(completed).completed,54);
 assert.equal(graph.points.find(point=>point.time===Date.parse(created)-1)!.scope,0);
 assert.equal(graph.points.at(-1)!.scope,54);assert.equal(graph.provenance?.missingPriorTransitions,true);
});

test('current progress trusts the current status when imported activity history is incomplete',()=>{
 const now=Date.parse('2026-09-10T16:00:00Z'),created='2026-09-05T08:00:00Z',completed='2026-09-08T19:32:00Z';
 const imported=e({id:'imported',createdAt:created,projectId:'project',statusId:'done',estimate:4,completedAt:completed});
 const incomplete=e({id:'created',entityKind:'issues',entityId:'imported',action:'create',createdAt:created,initialStatusId:'todo',initialStatusType:'unstarted',statusTypeBefore:null,statusTypeAfter:'unstarted'});
 const graph=buildProgressHistory({collection:e({id:'project',createdAt:'2026-09-04T00:00:00Z'}),kind:'project',issues:[imported],activities:[incomplete],statuses,teams:[],now});
 assert.equal(graph.scope,4);assert.equal(graph.started,0);assert.equal(graph.completed,4);
});
