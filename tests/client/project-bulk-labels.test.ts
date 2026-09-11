import test from 'node:test';import assert from 'node:assert/strict';import {projectBulkChanges} from '../../src/client/features/project-bulk-data';import type {Entity} from '../../src/shared/types';
const row=(id:string,fields:any={}):Entity=>({id,workspaceId:'w',createdAt:'2026-01-01',updatedAt:'2026-01-01',version:1,...fields});
test('bulk label additions replace grouped assignments per project while retaining mixed unrelated labels',()=>{
 const labels=[row('a',{group:'Size'}),row('b',{group:'Size'}),row('new',{group:'Size'}),row('other',{group:'Audience'}),row('loose')],projects=[row('p1',{labelIds:['a','other']}),row('p2',{labelIds:['b','loose']})];
 assert.deepEqual(projectBulkChanges(projects,{labelIds:['new']},true,['new'],labels).map(x=>x.data.labelIds),[['other','new'],['loose','new']]);
 assert.deepEqual(projectBulkChanges(projects,{labelIds:[]},true,['a'],labels).map(x=>x.data.labelIds),[['other'],['b','loose']]);
 assert.deepEqual(projectBulkChanges(projects,{labelIds:[]},true,[],labels).map(x=>x.data.labelIds),[['a','other'],['b','loose']]);
 assert.deepEqual(projectBulkChanges([row('p',{memberIds:['a','other']})],{memberIds:['new']},true,['new'],labels)[0].data.memberIds,['a','other','new']);
});
