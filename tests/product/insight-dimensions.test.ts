import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInsight,defaultInsight,type InsightSource} from '../../src/client/features/insight-data';
import type {Entity} from '../../src/shared/types';
const e=(fields:Record<string,unknown>):Entity=>({id:'x',workspaceId:'w',version:1,createdAt:'2026-01-31T23:30:00Z',updatedAt:'2026-02-08T00:00:00Z',...fields});
const source:InsightSource={issues:[e({id:'a',projectId:'p',milestoneId:'m',estimate:3,templateId:'t',externalSource:'Email',labelIds:['l'],customerId:'c',startedAt:'2026-02-01',completedAt:'2026-02-02',dueDate:'2026-02-14',statusId:'done'})],projects:[e({id:'p',initiativeIds:['child'],labelIds:['pl']})],statuses:[e({id:'done',type:'completed'})],activities:[],users:[],teams:[],cycles:[],labels:[e({id:'l',name:'Bug',labelGroupId:'lg'}),e({id:'pl',name:'Enterprise',labelGroupId:'pg',entityType:'projects'})],labelGroups:[e({id:'lg',name:'Type'}),e({id:'pg',name:'Market'})],customers:[e({id:'c',name:'Acme'}),e({id:'c2',name:'Beta'})],requests:[e({id:'r',issueIds:['a'],customerId:'c2'}),e({id:'r2',issueId:'a',customerId:'c'})],initiatives:[e({id:'child',name:'Child',parentId:'parent'}),e({id:'parent',name:'Parent'})],milestones:[e({id:'m',name:'Launch'})],templates:[e({id:'t',name:'Intake'})]};
test('documented relational and date dimensions resolve independent memberships with scoped label groups',()=>{
 const expected:Record<string,string[]>={'Customer':['Acme','Beta'],'Initiative':['Child','Parent'],'Milestone':['Launch'],'Estimate':['3'],'SLA status':['No SLA'],'Template':['Intake'],'External source':['Email'],'Label group':['Bug'],'Project label group':['Enterprise'],'Created date':['2026-01'],'Completed date':['2026-02'],'Started date':['2026-02'],'Canceled date':['No date'],'Due date':['2026-02']};
 for(const [group,names]of Object.entries(expected)){const result=calculateInsight(source,{...defaultInsight,group,groupLabelGroupId:group==='Label group'?'lg':'pg'},undefined,Date.parse('2026-02-08'));assert.deepEqual(result.rows[0].groups,names,group);assert.equal(result.total,1,group);}
 assert.deepEqual(calculateInsight(source,{...defaultInsight,group:'Created date',interval:'week'}).rows[0].groups,['2026-01-26']);
 assert.deepEqual(calculateInsight(source,{...defaultInsight,group:'Label group',groupLabelGroupId:'pg',segment:'Project label group',segmentLabelGroupId:'pg'}).rows[0].groups,['No Market']);
 assert.deepEqual(calculateInsight(source,{...defaultInsight,segment:'Customer'}).rows[0].segments,['Acme','Beta']);
});
test('Effort historical burn-up excludes currently canceled and triage records consistently with distribution',()=>{
 const data={...source,statuses:[...source.statuses,e({id:'cancel',type:'canceled'})],issues:[...source.issues,e({id:'b',statusId:'cancel',estimate:20})]};
 const result=calculateInsight(data,{...defaultInsight,measure:'Effort',group:'Burn-up'},undefined,Date.parse('2026-02-08'));
 assert.equal(result.total,3);assert.equal(result.burnup.at(-1)?.value,3);assert.equal(result.issues.length,1);
});

test('Added to cycle shares preserved assignment timing and leaves unknown legacy times unknown',()=>{const cycle=e({id:'cycle',startDate:'2026-02-01T00:00:00Z',endDate:'2026-02-08T00:00:00Z'}),issues=[e({id:'planned',cycleId:'cycle',cycleAddedAt:'2026-02-01T23:59:59.999Z'}),e({id:'late',cycleId:'cycle',cycleAddedAt:'2026-02-02T00:00:00.001Z'}),e({id:'legacy',cycleId:'cycle'})];const result=calculateInsight({...source,issues,cycles:[cycle]},{...defaultInsight,group:'Added to cycle'});assert.deepEqual(result.rows.map(row=>row.groups[0]),['Planned','During cycle','No info']);});
test('default latency preferences match the public client default configuration',()=>{assert.deepEqual(defaultInsight.latencyPercentiles,[.5,.95]);assert.equal(defaultInsight.latencyScale,'log');assert.equal(defaultInsight.interval,'month');assert.equal(defaultInsight.showArchived,false);});
