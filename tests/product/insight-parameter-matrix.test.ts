import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateInsight,defaultInsight,type InsightSource} from '../../src/client/features/insight-data';
import type {Entity} from '../../src/shared/types';
const row=(fields:Record<string,unknown>):Entity=>({id:'x',workspaceId:'w',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...fields});
const source:InsightSource={
 issues:[row({id:'a',title:'A',createdAt:'2026-01-01',startedAt:'2026-01-03',completedAt:'2026-01-05',statusId:'done',assigneeId:'ada',creatorId:'ben',teamId:'core',priority:2,projectId:'atlas',cycleId:'sprint',labelIds:['bug','backend'],estimate:3}),row({id:'b',title:'B',createdAt:'2026-01-02',startedAt:'2026-01-06',completedAt:'2026-01-09',statusId:'done',assigneeId:'ben',creatorId:'ada',teamId:'core',priority:4,projectId:'atlas',cycleId:'sprint',labelIds:['backend'],estimate:5}),row({id:'c',title:'C',createdAt:'2026-01-08',statusId:'todo',teamId:'growth'})],
 statuses:[row({id:'done',name:'Done',type:'completed'}),row({id:'todo',name:'Todo',type:'unstarted'}),row({id:'triage',name:'Triage',type:'triage'})],users:[row({id:'ada',name:'Ada'}),row({id:'ben',name:'Ben'})],teams:[row({id:'core',name:'Core'}),row({id:'growth',name:'Growth'})],projects:[row({id:'atlas',name:'Atlas',labelIds:['customer']})],cycles:[row({id:'sprint',name:'Sprint'})],labels:[row({id:'bug',name:'Bug'}),row({id:'backend',name:'Backend'}),row({id:'customer',name:'Customer',entityType:'projects'})],activities:[row({id:'triaged',entityKind:'issues',entityId:'b',createdAt:'2026-01-04T00:00:00Z',changes:{statusId:{from:'triage',to:'todo'}}})]
};
// Independent, hand-labelled fixture membership. No production categorization helper is used.
const labels:Record<string,string[][]>={
 'Status':[['Done'],['Done'],['Todo']], 'Status type':[['completed'],['completed'],['unstarted']],
 'Assignee':[['Ada'],['Ben'],['Unassigned']], 'Team':[['Core'],['Core'],['Growth']],
 'Priority':[['High'],['Low'],['No priority']], 'Project':[['Atlas'],['Atlas'],['No project']],
 'Cycle':[['Sprint'],['Sprint'],['No cycle']], 'Label':[['Bug','Backend'],['Backend'],['No label']],
 'Project label':[['Customer'],['Customer'],['No project label']], 'Creator':[['Ben'],['Ada'],['Unknown']],
 'Created week':[['2025-12-29'],['2025-12-29'],['2026-01-05']], 'Completed week':[['2026-01-05'],['2026-01-05'],['No date']],
 'None':[['All'],['All'],['All']]
};
const expected:Record<string,(number|null)[]>={'Issue count':[1,1,1],'Effort':[3,5,0],'Cycle Time':[2,3,null],'Lead Time':[4,7,null],'Triage Time':[null,2,null],'Issue Age':[19,18,12]};
for(const [measure,values]of Object.entries(expected))test(`${measure}: independent expected memberships and aggregates across 12 slices × 13 segments`,()=>{
 const selected=values.map((value,index)=>({value,index})).filter((entry):entry is {value:number;index:number}=>entry.value!==null),aggregate=(indices:number[])=>{const sum=indices.reduce((total,index)=>total+values[index]!,0);return ['Issue count','Effort'].includes(measure)?sum:sum/indices.length};
 for(const [group,groups]of Object.entries(labels).filter(([name])=>name!=='None'))for(const [segment,segments]of Object.entries(labels)){
  const result=calculateInsight(source,{...defaultInsight,measure,group,segment},undefined,Date.parse('2026-01-20'));
  assert.deepEqual(result.rows.map(row=>row.issue.id),selected.map(({index})=>'abc'[index]),`${group}/${segment} eligible issues`);
  assert.equal(result.total,aggregate(selected.map(({index})=>index)),`${group}/${segment} total`);
  const names=[...new Set(selected.flatMap(({index})=>groups[index]))].sort();assert.deepEqual(result.buckets.map(bucket=>bucket.label).sort(),names);
  for(const bucket of result.buckets){const indices=selected.filter(({index})=>groups[index].includes(bucket.label)).map(({index})=>index);assert.equal(bucket.value,aggregate(indices));assert.deepEqual(bucket.rows.map(row=>row.issue.id),indices.map(index=>'abc'[index]));const segmentNames=[...new Set(indices.flatMap(index=>segments[index]))].sort();assert.deepEqual(bucket.segments.map(segment=>segment.label).sort(),segmentNames);for(const part of bucket.segments){const members=indices.filter(index=>segments[index].includes(part.label));assert.equal(part.value,aggregate(members));assert.deepEqual(part.rows.map(row=>row.issue.id),members.map(index=>'abc'[index]));}}
 }
});
