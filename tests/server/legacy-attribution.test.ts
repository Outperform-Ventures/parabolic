import test from 'node:test';import assert from 'node:assert/strict';import {contentAttribution} from '../../src/shared/content-attribution.ts';
const entity:any={id:'doc',creatorId:'creator',createdAt:'2026-01-01',updatedAt:'2026-01-09',version:4,history:[{}]};
test('legacy attribution uses content events rather than newer metadata or another entity',()=>{
 const events:any[]=[{id:'a',entityKind:'documents',entityId:'doc',createdAt:'2026-01-02',actorId:'editor',changes:{content:{from:'old',to:'new'}}},{id:'b',entityKind:'documents',entityId:'doc',createdAt:'2026-01-09',actorId:'metadata-editor',changes:{visibility:{from:'private',to:'workspace'}}},{id:'c',entityKind:'documents',entityId:'other',createdAt:'2026-01-10',actorId:'other',changes:{content:{from:'old',to:'new'}}}];
 assert.deepEqual(contentAttribution(entity,'documents',events),{userId:'editor',at:'2026-01-02'});
 assert.deepEqual(contentAttribution(entity,'documents',[]),{userId:null,at:null});
 assert.deepEqual(contentAttribution({...entity,version:1,history:[]},'documents'),{userId:'creator',at:'2026-01-01'});
 assert.deepEqual(contentAttribution({...entity,lastEditedBy:'verified',lastEditedAt:'2026-01-11'},'documents',events),{userId:'verified',at:'2026-01-11'});
});
test('equal-time content events use entity version and exclude no-op values',()=>{
 const events:any[]=[{entityKind:'projects',entityId:'doc',createdAt:'2026-01-02',entityVersion:2,actorId:'older',changes:{name:{from:'a',to:'b'}}},{entityKind:'projects',entityId:'doc',createdAt:'2026-01-02',entityVersion:3,actorId:'newer',changes:{description:{from:'a',to:'b'}}},{entityKind:'projects',entityId:'doc',createdAt:'2026-01-03',actorId:'noop',changes:{description:{from:'b',to:'b'}}}];assert.deepEqual(contentAttribution(entity,'projects',events),{userId:'newer',at:'2026-01-02'});
});
