import test from 'node:test';import assert from 'node:assert/strict';
import {emptyData,type Entity} from '../../src/shared/types';import {inboxPresentation} from '../../src/client/inbox-presentation';import {notificationDestination} from '../../src/client/notification-destination';
const entity=(id:string,fields:Record<string,any>={}):Entity=>({id,workspaceId:'workspace',createdAt:'2026-09-06T00:00:00Z',updatedAt:'2026-09-06T00:00:00Z',version:1,...fields});
test('document notifications describe their events and retain document identity when the project is also present',()=>{
 const data=emptyData();data.users=[entity('actor',{name:'Alex',username:'alex'})];data.projects=[entity('project',{name:'Parent project'})];data.documents=[entity('doc',{title:'Document title',projectId:'project'})];
 for(const [type,verb,icon] of [['documentContentChange','edited','Pencil'],['documentDeleted','deleted','Trash2'],['documentRestored','restored','FileText'],['documentMoved','moved','FolderInput']]){const result=inboxPresentation(entity(type,{type,actorId:'actor',documentId:'doc',projectId:'project',title:'Stored title'}),data);assert.equal(result.title,'Document title');assert.equal(result.summary,`Alex ${verb} the document`);assert.equal(result.entityIcon,'FileText');assert.equal(result.icon,icon)}
 for(const [type,summary] of [['documentSubscribed','Alex subscribed you to the document'],['documentUnsubscribed','Alex unsubscribed you from the document']])assert.equal(inboxPresentation(entity(type,{type,actorId:'actor',documentId:'doc'}),data).summary,summary);
 const notice=entity('missing',{type:'documentContentChange',documentId:'uncached',projectId:'project',title:'Uncached document'});assert.equal(inboxPresentation(notice,data).title,'Uncached document');assert.equal(inboxPresentation(notice,data).entityIcon,'FileText');assert.equal(inboxPresentation(notice,data).summary,'Someone edited the document');
 assert.equal(inboxPresentation(entity('mention',{type:'documentContentChange',reasons:['documentContentChange','mentioned'],actorId:'actor',documentId:'doc'}),data).summary,'Alex mentioned you');
 assert.equal(inboxPresentation(entity('unassigned',{type:'unassigned',actorId:'actor'}),data).summary,'Alex unassigned you from the issue');
});
test('notification destinations prefer the specific document or issue and preserve updates and encoded identifiers',()=>{
 assert.deepEqual(notificationDestination(entity('doc',{documentId:'doc',projectId:'project'})),{kind:'document',route:'/document/doc'});
 assert.deepEqual(notificationDestination(entity('legacy',{entityKind:'documents',entityId:'doc/a',projectId:'project'})),{kind:'document',route:'/document/doc%2Fa'});
 assert.deepEqual(notificationDestination(entity('issue',{issueId:'i',projectId:'project',documentId:'doc'})),{kind:'issue',route:'/issues/i'});
 for(const fields of [{entityKind:'documents',entityId:'doc'}, {type:'documentMoved',documentId:'doc'}]){const notice=entity('document-issue',{issueId:'i',...fields});assert.deepEqual(notificationDestination(notice),{kind:'document',route:'/document/doc'});assert.equal(inboxPresentation(notice,emptyData(),entity('i',{title:'Parent issue'})).issue,undefined)}
 assert.deepEqual(notificationDestination(entity('update',{projectId:'p',updateId:'u'})),{kind:'project',route:'/project/p/updates#update-u'});
 assert.deepEqual(notificationDestination(entity('prompt',{initiativeId:'a',type:'initiativeUpdatePrompt'})),{kind:'initiative',route:'/initiative/a/updates'});
 assert.deepEqual(notificationDestination(entity('unknown')),{kind:'inbox',route:'/inbox'});
});
