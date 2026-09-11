import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInsight,defaultInsight} from '../../src/client/features/insight-data';
import type {Entity} from '../../src/shared/types';
const entity=(fields:Record<string,unknown>):Entity=>({id:'x',workspaceId:'w',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-10T00:00:00Z',version:1,...fields});
const statuses=['triage','unstarted','started','completed','canceled','duplicate'].map(type=>entity({id:type,name:type,type}));
test('time in selected states integrates separate visits and clips future changes without double counting overlapping type and ID selections',()=>{
 const issue=entity({id:'i',statusId:'completed'}),activities=[['2026-01-02','triage','unstarted'],['2026-01-03','unstarted','started'],['2026-01-05','started','unstarted'],['2026-01-07','unstarted','started'],['2026-01-10','started','completed']].map(([at,from,to])=>entity({id:at,createdAt:at+'T00:00:00Z',entityKind:'issues',entityId:'i',changes:{statusId:{from,to}}}));
 const source={issues:[issue],activities,statuses,users:[],teams:[],projects:[],cycles:[],labels:[]},config={...defaultInsight,measure:'Time in status',measureStatusTypes:['started'],measureStatusIds:['started']};
 assert.equal(calculateInsight(source,config,undefined,Date.parse('2026-01-12')).rows[0].value,5);
 assert.equal(calculateInsight(source,config,undefined,Date.parse('2026-01-08')).rows[0].value,3);
 assert.equal(calculateInsight(source,{...config,measureStatusTypes:['triage'],measureStatusIds:[]},undefined,Date.parse('2026-01-12')).rows[0].value,1);
 assert.equal(calculateInsight(source,{...config,measureStatusTypes:[],measureStatusIds:[]},undefined,Date.parse('2026-01-12')).rows.length,0);
});
test('Effort excludes triage canceled and duplicate while Issue count retains them',()=>{
 const source={issues:statuses.map(status=>entity({id:status.id,statusId:status.id,estimate:5})),statuses,activities:[],users:[],teams:[],projects:[],cycles:[],labels:[]};
 assert.equal(calculateInsight(source,{...defaultInsight,measure:'Effort'}).total,15);
 assert.equal(calculateInsight(source,{...defaultInsight,measure:'Issue count'}).total,6);
});
