import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,type Entity} from '../../src/shared/types';
import {initialIssueFields} from '../../src/client/template-utils';
import {initialWorkflowStatus,workflowDefaultStatus} from '../../src/client/issue-workflow';

test('issue composer defaults follow ordered Backlog or explicit Todo while nonmember intake keeps triage',()=>{
  const data=emptyData(),record=(id:string,properties:Record<string,unknown>):Entity=>({id,workspaceId:'workspace',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...properties});
  data.teams=[record('team',{creatorId:'owner',triageEnabled:true})];
  data.statuses=[record('triage',{teamId:'team',type:'triage',position:0}),record('later',{teamId:'team',type:'backlog',position:2}),record('first',{teamId:'team',type:'backlog',position:1}),record('todo',{teamId:'team',type:'unstarted',position:0}),record('old',{teamId:'team',type:'backlog',position:-1,deletedAt:'2026-01-02T00:00:00Z'})];
  assert.equal(workflowDefaultStatus(data,'team')?.id,'first');
  assert.equal(initialIssueFields({teamId:'team'},data,'owner').statusId,'first');
  for(const teamId of [undefined,null])assert.equal(initialIssueFields({teamId},data,'owner').teamId,'team','Workspace-wide defaults must preserve the resolved team');
  assert.equal(initialWorkflowStatus(data,'team','outside')?.id,'triage');
  data.teams[0].defaultStatusId='todo';
  assert.equal(initialIssueFields({teamId:'team'},data,'owner').statusId,'todo');
  assert.equal(initialIssueFields({teamId:'team',statusId:'later'},data,'owner').statusId,'later');
  data.teams[0].triageEnabled=false;
  assert.equal(initialWorkflowStatus(data,'team','outside')?.id,'todo');
  data.teams[0].defaultStatusId=null;data.statuses.find(status=>status.id==='later')!.position=0;
  assert.equal(initialIssueFields({teamId:'team'},data,'owner').statusId,'later');
});

test('sub-issues inherit a parent cycle only when created in an active workflow category',()=>{
  const data=emptyData(),record=(id:string,properties:Record<string,unknown>):Entity=>({id,workspaceId:'workspace',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,...properties});
  data.teams=[record('team',{creatorId:'owner'})];
  data.statuses=['backlog','unstarted','started','completed','canceled','triage'].map(type=>record(type,{teamId:'team',type,position:0}));
  data.issues=[record('parent',{teamId:'team',cycleId:'cycle',projectId:'project',priority:2,assigneeId:'owner'})] as typeof data.issues;
  assert.equal(initialIssueFields({parentId:'parent'},data,'owner').cycleId,null);
  data.teams[0].defaultStatusId='unstarted';
  assert.equal(initialIssueFields({parentId:'parent'},data,'owner').cycleId,'cycle');
  assert.equal(initialIssueFields({parentId:'parent',statusId:'started'},data,'owner').cycleId,'cycle');
  for(const statusId of ['backlog','triage','completed','canceled'])assert.equal(initialIssueFields({parentId:'parent',statusId},data,'owner').cycleId,null);
});
