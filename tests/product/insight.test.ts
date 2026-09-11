import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateInsight,defaultInsight,percentile,type InsightSource} from '../../src/client/features/insight-data.ts';
import type {Entity} from '../../src/shared/types.ts';
const e=(fields:Record<string,any>):Entity=>({id:'x',workspaceId:'w',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...fields});
const source:InsightSource={issues:[e({id:'a',title:'Customer A',statusId:'done',estimate:3,startedAt:'2026-01-03T00:00:00Z',completedAt:'2026-01-05T00:00:00Z'}),e({id:'b',title:'Customer B',statusId:'todo',estimate:5}),e({id:'c',title:'Internal work',statusId:'todo',estimate:8,archivedAt:'2026-01-04T00:00:00Z'})],statuses:[e({id:'todo',name:'Todo',type:'unstarted'}),e({id:'done',name:'Done',type:'completed'})],teams:[],users:[],projects:[],cycles:[],labels:[],activities:[]};
test('insights measure real durations and compose global plus per-insight filters',()=>{
  assert.equal(calculateInsight(source,{...defaultInsight,measure:'Effort'}).total,8);
  assert.equal(calculateInsight(source,{...defaultInsight,measure:'Effort',showArchived:true}).total,16);
  const scoped=calculateInsight(source,{...defaultInsight,measure:'Effort',filters:{conditions:[{field:'estimate',operator:'gte',value:5}],match:'all'}},{conditions:[{field:'title',operator:'contains',value:'Customer'}],match:'all'});assert.equal(scoped.total,5);assert.deepEqual(scoped.rows.map(r=>r.issue.id),['b']);
  const cycle=calculateInsight(source,{...defaultInsight,measure:'Cycle Time'});assert.equal(cycle.total,2);assert.equal(cycle.rows.length,1);
  assert.equal(calculateInsight(source,{...defaultInsight,measure:'Lead Time'}).total,4);
  assert.equal(percentile([1,2,3,4,5],.5),3);assert.equal(percentile([1,2,3,4,5],.95),4.8);
});
test('historical burn-up reconstructs estimates and workflow state at each period',()=>{
  const historical={...source,issues:[e({id:'a',statusId:'done',estimate:5,createdAt:'2026-01-02T00:00:00Z'})],activities:[e({id:'event',entityKind:'issues',entityId:'a',createdAt:'2026-01-10T00:00:00Z',changes:{statusId:{from:'todo',to:'done'},estimate:{from:2,to:5}}})]};
  const result=calculateInsight(historical,{...defaultInsight,measure:'Effort',group:'Burn-up',interval:'week'},undefined,Date.parse('2026-01-20T00:00:00Z'));
  assert.equal(result.burnup[0].value,0);assert.equal(result.burnup.find(p=>new Date(p.time).toISOString().startsWith('2026-01-05'))?.segments.unstarted,2);assert.equal(result.burnup.at(-1)?.segments.completed,5);
});

test('project label insights include every upstream label without inflating distinct issue totals',()=>{
 const input={...source,issues:[e({id:'a',projectId:'p',estimate:3}),e({id:'b',estimate:5})],projects:[e({id:'p',labelIds:['a','b','a','removed']})],labels:[e({id:'a',name:'Enterprise',entityType:'projects'}),e({id:'b',name:'Large',entityType:'projects',archivedAt:'2026-01-01'}),e({id:'removed',name:'Deleted',entityType:'projects',deletedAt:'2026-01-01'})]};
 const grouped=calculateInsight(input,{...defaultInsight,group:'Project label'});
 assert.equal(grouped.total,2);assert.deepEqual(grouped.buckets.map(b=>b.label).sort(),['Enterprise','Large','No project label']);assert.ok(grouped.buckets.every(b=>b.count===1));
 const segmented=calculateInsight(input,{...defaultInsight,segment:'Project label',measure:'Effort'});
 assert.equal(segmented.total,8);assert.deepEqual(segmented.buckets[0].segments.map(s=>[s.label,s.value]),[['Enterprise',3],['Large',3],['No project label',5]]);
 const age=calculateInsight(input,{...defaultInsight,group:'Project label',measure:'Issue Age'},undefined,Date.parse('2026-01-04T00:00:00Z'));assert.ok(age.buckets.every(b=>b.value===3));
 const burn=calculateInsight(input,{...defaultInsight,group:'Burn-up',segment:'Project label'},undefined,Date.parse('2026-01-04T00:00:00Z'));assert.equal(burn.burnup.at(-1)?.value,2);assert.deepEqual(Object.fromEntries(Object.entries(burn.burnup.at(-1)!.segments).map(([key,value])=>[burn.segmentLabels?.[key],value])),{Enterprise:1,Large:1,'No project label':1});
 assert.deepEqual(calculateInsight({...input,projects:[]},{...defaultInsight,group:'Project label'}).buckets.map(b=>[b.label,b.count]),[['No project label',2]]);
});

test('creator insights label requester snapshots without adding them to member or assignee data',()=>{
 const requester=e({id:'request',creatorId:'external',creatorIdentity:{id:'external',kind:'requester',name:'External employee'},statusId:'todo'}),input={...source,issues:[requester],users:[]};const result=calculateInsight(input,{...defaultInsight,group:'Creator'});assert.deepEqual(result.buckets.map(bucket=>bucket.label),['External employee']);assert.deepEqual(input.users,[]);assert.deepEqual(calculateInsight(input,{...defaultInsight,group:'Assignee'}).buckets.map(bucket=>bucket.label),['Unassigned']);const forged={...input,issues:[{...requester,creatorIdentity:{id:'other',kind:'requester',name:'Forged'}}]};assert.deepEqual(calculateInsight(forged,{...defaultInsight,group:'Creator'}).buckets.map(bucket=>bucket.label),['Unknown']);
});

test('duration insights exclude reopened and canceled work despite earlier completion events',()=>{const issues=[e({id:'done-work',statusId:'done',startedAt:'2026-01-02T00:00:00Z',completedAt:'2026-01-04T00:00:00Z'}),e({id:'reopened',statusId:'todo',startedAt:'2026-01-02T00:00:00Z',completedAt:null}),e({id:'canceled-work',statusId:'canceled',completedAt:'2026-01-04T00:00:00Z'})],activities=[e({id:'completed-once',entityKind:'issues',entityId:'reopened',createdAt:'2026-01-04T00:00:00Z',changes:{statusId:{from:'todo',to:'done'}}}),e({id:'reopened-event',entityKind:'issues',entityId:'reopened',createdAt:'2026-01-05T00:00:00Z',changes:{statusId:{from:'done',to:'todo'}}})],input={...source,issues,activities,statuses:[...source.statuses,e({id:'canceled',name:'Canceled',type:'canceled'})]};for(const measure of ['Lead Time','Cycle Time'])assert.deepEqual(calculateInsight(input,{...defaultInsight,measure},undefined,Date.parse('2026-01-10')).rows.map(row=>row.issue.id),['done-work']);assert.equal(calculateInsight(input,{...defaultInsight,measure:'Issue Age'},undefined,Date.parse('2026-01-10')).rows.length,3)});
