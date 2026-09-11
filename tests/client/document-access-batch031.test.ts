import assert from 'node:assert/strict';
import test from 'node:test';
import {documentReadOnlyReason} from '../../src/client/document-access';
import {emptyData,type Entity} from '../../src/shared/types';

test('document read-only projection follows the server-enforced parent paths',()=>{
 const entity=(id:string,fields:Partial<Entity>={}):Entity=>({id,workspaceId:'workspace',createdAt:'2026-09-10T12:00:00Z',updatedAt:'2026-09-10T12:00:00Z',version:1,...fields});
 const data=emptyData(),retired=entity('retired',{name:'Retired',archivedAt:'2026-09-10T12:00:00Z'}),active=entity('active',{name:'Active'});
 data.teams.push(retired,active);
 data.issues.push(entity('issue',{teamId:retired.id}));
 data.projects.push(entity('exclusive',{teamIds:[retired.id]}),entity('shared',{teamIds:[retired.id,active.id]}));

 assert.equal(documentReadOnlyReason(entity('direct',{teamId:retired.id}),data),'This team is retired. This document is read-only.');
 assert.equal(documentReadOnlyReason(entity('issue-doc',{issueId:'issue'}),data),'This team is retired. This document is read-only.');
 assert.equal(documentReadOnlyReason(entity('project-doc',{projectId:'exclusive'}),data),'All teams associated with this document are retired. This document is read-only.');
 assert.equal(documentReadOnlyReason(entity('shared-doc',{projectId:'shared'}),data),null);
 assert.equal(documentReadOnlyReason(entity('unparented'),data),null);
});
