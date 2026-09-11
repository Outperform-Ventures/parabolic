import test from 'node:test';
import assert from 'node:assert/strict';
import {compareActivities,buildStatusHistory} from '../../src/shared/activity-history.ts';
import {buildProgressHistory} from '../../src/client/features/progress-data.ts';
import {calculateInsight,defaultInsight} from '../../src/client/features/insight-data.ts';
import type {Entity} from '../../src/shared/types.ts';
const e=(id:string,fields:Record<string,any>={}):Entity=>({id,workspaceId:'w',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',version:1,...fields});
const events=[
  e('created',{entityKind:'issues',entityId:'issue',action:'create',sequence:10,entityVersion:1,initialStatusId:'triage',initialStatusType:'triage',statusTypeBefore:null,statusTypeAfter:'triage'}),
  e('started',{entityKind:'issues',entityId:'issue',action:'update',createdAt:'2026-01-02T00:00:00.000Z',sequence:11,entityVersion:2,statusTypeBefore:'triage',statusTypeAfter:'started',changes:{statusId:{from:'triage',to:'started'}}}),
  e('z-completed',{entityKind:'issues',entityId:'issue',action:'update',createdAt:'2026-01-03T00:00:00.000Z',sequence:12,entityVersion:3,statusTypeBefore:'started',statusTypeAfter:'completed',changes:{statusId:{from:'started',to:'done'},estimate:{from:2,to:5}}}),
  e('a-reestimated',{entityKind:'issues',entityId:'issue',action:'update',createdAt:'2026-01-03T00:00:00.000Z',sequence:13,entityVersion:4,statusTypeBefore:'completed',statusTypeAfter:'completed',changes:{estimate:{from:5,to:8}}}),
  ...[['triage','triage','unstarted'],['started','started','canceled'],['done','completed','unstarted']].map(([id,from,to],i)=>e('definition-'+id,{entityKind:'statuses',entityId:id,action:'update',createdAt:'2026-01-10T00:00:00.000Z',sequence:20+i,changes:{type:{from,to}}})),
];
const statuses=[e('triage',{name:'Intake',type:'unstarted'}),e('started',{name:'In progress',type:'canceled'}),e('done',{name:'Done',type:'unstarted'})],issue=e('issue',{projectId:'p',statusId:'done',estimate:8}),collection=e('p',{name:'Project'});

test('progress historical states preserve same-time edit order and workflow categories for reversed activity input',()=>{
  for(const activities of [events,[...events].reverse()]){
    const input={collection,kind:'project' as const,issues:[issue],activities,statuses,teams:[]};
    const initial=buildProgressHistory({...input,now:Date.parse('2026-01-01T12:00:00Z')});assert.equal(initial.scope,0);assert.equal(initial.started,0);assert.equal(initial.completed,0);
    const started=buildProgressHistory({...input,now:Date.parse('2026-01-02T12:00:00Z')});assert.equal(started.scope,2);assert.equal(started.started,2);
    const completed=buildProgressHistory({...input,now:Date.parse('2026-01-04T00:00:00Z')});assert.equal(completed.scope,8);assert.equal(completed.completed,8);
    const recategorized=buildProgressHistory({...input,now:Date.parse('2026-01-11T00:00:00Z')});assert.equal(recategorized.scope,8);assert.equal(recategorized.completed,0);
  }
});

test('Insights durations and burn-up use recorded history while current grouping retains current workflow categories',()=>{
  for(const activities of [events,[...events].reverse()]){
    const source={issues:[issue],activities,statuses,teams:[],users:[],projects:[collection],cycles:[],labels:[]},now=Date.parse('2026-02-01T00:00:00Z');
    assert.equal(calculateInsight(source,{...defaultInsight,measure:'Lead Time'},undefined,now).total,2);assert.equal(calculateInsight(source,{...defaultInsight,measure:'Cycle Time'},undefined,now).total,1);assert.equal(calculateInsight(source,{...defaultInsight,measure:'Triage Time'},undefined,now).total,1);
    assert.equal(calculateInsight(source,{...defaultInsight,group:'Status type'},undefined,now).buckets[0].label,'unstarted');
    const monthly=calculateInsight(source,{...defaultInsight,measure:'Effort',group:'Burn-up',interval:'month'},undefined,now);assert.deepEqual(monthly.burnup[0].segments,{triage:2});assert.deepEqual(monthly.burnup.at(-1)!.segments,{unstarted:8});
    const weekly=calculateInsight(source,{...defaultInsight,measure:'Effort',group:'Burn-up',interval:'week'},undefined,now);assert.deepEqual(weekly.burnup.find(point=>point.time===Date.parse('2026-01-05'))!.segments,{completed:8});
  }
});

test('legacy status definitions reconstruct categories without inventing missing issue metadata',()=>{
  const legacy=events.map(event=>{const copy={...event};delete copy.statusTypeBefore;delete copy.statusTypeAfter;delete copy.initialStatusType;return copy;}),lookup=buildStatusHistory(statuses,legacy);
  assert.equal(lookup.eventCategory(legacy[1],'before'),'triage');assert.equal(lookup.eventCategory(legacy[1],'after'),'started');assert.equal(lookup.eventCategory(legacy[2],'after'),'completed');assert.equal(lookup.categoryAt('missing',Date.parse('2026-01-05')),undefined);
  const absent=e('unknown',{entityKind:'issues',entityId:'unknown',action:'update',statusTypeAfter:null});assert.equal(lookup.eventCategory(absent,'after','done'),undefined);
  const sameTime=[e('later',{entityKind:'issues',entityId:'i',entityVersion:3}),e('earlier',{entityKind:'issues',entityId:'i',entityVersion:2})];assert.deepEqual(sameTime.sort(compareActivities).map(event=>event.entityVersion),[2,3]);
});
