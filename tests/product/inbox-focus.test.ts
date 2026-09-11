import test from 'node:test';
import assert from 'node:assert/strict';
import {groupInboxFocus,type InboxFocusOptions} from '../../src/client/inbox-focus';
import type {Entity} from '../../src/shared/types';

const entity=(id:string,fields:Record<string,any>={}):Entity=>({id,workspaceId:'workspace',version:1,createdAt:'2026-09-01T12:00:00Z',updatedAt:'2026-09-01T12:00:00Z',...fields});
const rows=(type:string,count:number,fields:Record<string,any>={})=>Array.from({length:count},(_,index)=>entity(type+index,{type,...fields}));
const urgent=()=>entity('urgent',{type:'status',issueId:'urgent-issue'});
const context:InboxFocusOptions={issues:[entity('urgent-issue',{priority:1,statusId:'open'}),entity('done-issue',{priority:1,statusId:'done'}),entity('triage-issue',{priority:0,statusId:'triage'})],statuses:[entity('open',{type:'unstarted'}),entity('done',{type:'completed'}),entity('triage',{type:'triage'})]};
const groups=(notifications:Entity[],options:InboxFocusOptions=context)=>groupInboxFocus(notifications,options).filter(row=>row.type==='group').map(row=>[row.id,row.title,row.count]);

test('Focus precedence uses current open urgency, SLA, reminders, mentions, human replies and then other categories',()=>{
  const notifications=[entity('urgent-mentioned',{type:'mentioned',issueId:'urgent-issue'}),entity('closed-sla',{type:'slaAtRisk',issueId:'done-issue'}),entity('reminder',{type:'reminder'}),entity('mentioned-comment',{type:'comments',reasons:['comments','mentioned'],entityKind:'comments',entityId:'thread-reply'}),entity('reply',{type:'comments',entityKind:'comments',entityId:'thread-reply'}),entity('closed-status',{type:'status',issueId:'done-issue'})];
  const result=groupInboxFocus(notifications,{...context,comments:[entity('thread-reply',{parentId:'thread-root'})]});
  assert.deepEqual(result.filter(row=>row.type==='group').map(row=>[row.id,row.title,row.count]),[['focus-urgent','Urgent',1],['focus-slas','SLAs',1],['focus-reminders','Reminders',1],['focus-mentions-replies','Mentions & replies',2],['focus-completed','Completed',1]]);
  assert.deepEqual(new Set(result.flatMap(row=>row.type==='notification'?[row.item]:[])),new Set(notifications));
});

test('Mentions/replies split at five and a stack counts once while any reply member identifies its thread',()=>{
  assert.deepEqual(groups([urgent(),...rows('mentioned',4),...rows('comments',4,{parentCommentId:'root'})]),[['focus-urgent','Urgent',1],['focus-mentions-replies','Mentions & replies',8]]);
  assert.deepEqual(groups([urgent(),...rows('mentioned',5),...rows('comments',1,{parentCommentId:'root'})]),[['focus-urgent','Urgent',1],['focus-mentions','Mentions',5],['focus-replies','Replies',1]]);
  const main=entity('stack-main',{type:'comments'}),others=rows('comments',8,{parentCommentId:'root'});assert.deepEqual(groups([urgent(),main],{...context,otherNotifications:()=>others}),[['focus-urgent','Urgent',1],['focus-replies','Replies',1]]);
  assert.deepEqual(groups([urgent(),entity('mention-stack',{type:'mentioned'})],{...context,otherNotifications:()=>others}),[['focus-urgent','Urgent',1],['focus-mentions','Mentions',1]]);
});

test('Other honors direct-child thresholds, nested assignment thresholds and trailing singleton folding',()=>{
  const unknown=entity('unknown',{type:'unmapped'}),assigned=rows('assigned',5,{issueId:'unassigned-priority'});
  assert.deepEqual(groups([urgent(),...assigned,unknown]),[['focus-urgent','Urgent',1],['focus-other','Other',6]],'Five assigned issues cannot by themselves split Other before its six-item assignment cutoff');
  assert.deepEqual(groups([...rows('comments',2),...assigned,unknown]),[['focus-comments','Comments',2],['focus-issue-assignments','Assigned issues',5],['focus-other','Other',1]],'Once Other expands, a five-item assignment child qualifies');
  assert.deepEqual(groups([...rows('comments',2),...rows('triage',1),...rows('documentChanges',1),...rows('requests',1)]),[['focus-comments','Comments',2],['focus-other','Other',3]]);
  assert.deepEqual(groups([...rows('comments',2),...rows('triage',1),...rows('requests',2)]),[['focus-comments','Comments',2],['focus-triage','Triage',1],['focus-customers','Customer requests',2]],'A later non-singleton stops trailing singleton folding');
  assert.deepEqual(groups([...rows('assigned',5,{issueId:'issue'}),...rows('projectAddedAsLead',1)]),[['focus-issue-assignments','Assigned issues',5],['focus-project-lead','Project lead',1]]);
});

test('Update, subscription, customer and closed-state cutoffs preserve every input without excluded feature headings',()=>{
  const unknown=entity('other',{type:'other'});
  assert.deepEqual(groups([urgent(),...rows('initiativeUpdates',4),...rows('projectUpdates',1)]),[['focus-urgent','Urgent',1],['focus-updates','Updates',5]]);
  assert.deepEqual(groups([urgent(),...rows('initiativeUpdates',5),...rows('projectUpdates',1)]),[['focus-urgent','Urgent',1],['focus-initiative-updates','Initiative updates',5],['focus-project-updates','Project updates',1]]);
  for(const [type,id,title,minimum,fields]of [['subscriptions','subscriptions','Subscriptions',6,{}],['documentChanges','document-changes','Document changes',6,{}],['requests','customers','Customer requests',6,{}],['reactions','reactions','Reactions',6,{}],['status','completed','Completed',10,{issueId:'done-issue'}]] as const){assert.deepEqual(groups([urgent(),...rows(type,minimum-1,fields),unknown]),[['focus-urgent','Urgent',1],['focus-other','Other',minimum]]);assert.deepEqual(groups([urgent(),...rows(type,minimum,fields),unknown]),[['focus-urgent','Urgent',1],['focus-'+id,title,minimum],['focus-other','Other',1]]);}
  const excluded=['agents','reviews','feed','billing'].map(category=>entity(category,{category,type:category})),result=groupInboxFocus(excluded);assert.deepEqual(result.filter(row=>row.type==='group').map(row=>row.title),['Unread']);assert.deepEqual(result.flatMap(row=>row.type==='notification'?[row.item.id]:[]).sort(),excluded.map(row=>row.id).sort(),'Unexpected historical categories remain visible in Other without adding excluded features');
  assert.deepEqual(groups([urgent(),...rows('reactions',6,{entityKind:'comments',parentCommentId:'thread'}),...rows('reactions',1,{entityKind:'updates'})]),[['focus-urgent','Urgent',1],['focus-reactions','Reactions',7]],'Explicit reaction events are not reclassified by their comment/update target');
});

test('Focus uses first-seen read state, folds a single unread heading and leaves an all-read inbox flat',()=>{
  const opened=entity('opened',{type:'mentioned',readAt:'2026-09-02T00:00:00Z'}),old=entity('old',{type:'reminder',readAt:'2026-09-02T00:00:00Z'}),snapshot=new Map([[opened.id,false],[old.id,true]]);
  assert.deepEqual(groups([opened,old],{showReadItems:true,readStateOnFirstSeen:snapshot}),[['focus-mentions','Unread',1],['focus-read','Read',1]]);
  const allRead=groupInboxFocus([old],{showReadItems:true,readStateOnFirstSeen:{old:true}});assert.deepEqual(allRead,[{type:'notification',item:old}]);assert.equal(allRead[0].type==='notification'&&allRead[0].item,old);
  assert.deepEqual(groups([opened],{showReadItems:false,readStateOnFirstSeen:{opened:true}}),[['focus-mentions','Unread',1]],'Caller filters visible rows; snapshot separation is only active when read items are displayed');
  assert.deepEqual(groupInboxFocus([]),[]);
});
