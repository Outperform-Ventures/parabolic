import test from 'node:test';
import assert from 'node:assert/strict';
import {profileIssueDisplay} from '../../src/client/my-issues-state.ts';
import {legacyProfileProperties, migrateProfileDisplay, profileStatusOrder} from '../../src/client/profile-display.ts';

test('member profile Assigned and Created use retained native display defaults',()=>{
 const assigned=profileIssueDisplay('Assigned'),created=profileIssueDisplay('Created');
 assert.equal(assigned.groupBy,'statusId');
 assert.equal(assigned.orderBy,'createdAt');
 assert.equal(assigned.direction,'desc');
 assert.equal(assigned.groupCount,'estimate');
 assert.equal(created.groupBy,'none');
 assert.equal(created.orderBy,'createdAt');
 assert.equal(created.direction,'desc');
 assert.equal(created.completedWindow,'all');
 assert.equal(created.nestedSubIssues,true);
 assert.deepEqual(created.properties,['identifier','statusId','assigneeId','priority','projectId','dueDate','estimate','labelIds','createdAt']);
});

test('profile status order uses semantic types, not English labels or team positions',()=>{
 const statuses=[{id:'backlog',name:'Future',type:'backlog',position:0},{id:'todo',name:'Ready',type:'unstarted',position:1},{id:'doing',name:'Building',type:'started',position:2}];
 assert.deepEqual(profileStatusOrder(statuses as any),['doing','todo','backlog']);
 assert.deepEqual(statuses.map(s=>s.id),['backlog','todo','doing']);
});

test('legacy profile defaults rebase once without discarding intentional customizations',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
 const legacy={properties:[...legacyProfileProperties],groupBy:'statusId',groupCount:'issues',orderBy:'priority',direction:'asc',groupOrder:['custom'],hiddenGroups:{statusId:['hidden']}};
 const migrated=migrateProfileDisplay(storage,'profile',legacy,'Assigned');
 assert.equal(migrated.properties,undefined);assert.equal(migrated.groupCount,undefined);assert.equal(migrated.orderBy,undefined);
 assert.deepEqual(migrated.groupOrder,['custom']);assert.deepEqual(migrated.hiddenGroups,legacy.hiddenGroups);
 const custom={...legacy,properties:['identifier','timeInStatus'],orderBy:'title'};
 assert.deepEqual(migrateProfileDisplay(storage,'custom',custom,'Assigned'),custom);
 assert.deepEqual(migrateProfileDisplay(storage,'profile',legacy,'Assigned'),legacy);
 assert.equal(legacy.properties.length,15);
});
