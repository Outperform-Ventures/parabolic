import test from 'node:test';import assert from 'node:assert/strict';
import {myIssueTab,myIssueDisplay,myIssueActivity} from '../../src/client/my-issues-state';
import {retainedPaletteCommands} from '../../src/client/palette-commands';
import {issueBulkPropertyChanges,commonIssueValues} from '../../src/client/issue-bulk-properties';
import {edgeScrollVelocity} from '../../src/client/drag-edge-scroll';
import {searchTokens,matchesSearchTokens,searchStatusRank} from '../../src/client/search-language';
import type {Entity} from '../../src/shared/types';
const entities=(rows:any[])=>rows as Entity[];
test('My Issues tabs follow URL defaults and reset restores creation/subscription/activity sort',()=>{assert.equal(myIssueTab('?tab=Activity'),'Activity');assert.equal(myIssueTab(''),'Assigned');assert.equal(myIssueTab('?tab=invalid'),'Assigned');assert.deepEqual(myIssueDisplay('Created'),{groupBy:'none',orderBy:'createdAt',direction:'desc',showEmpty:false});assert.deepEqual(myIssueDisplay('Subscribed'),{groupBy:'none',orderBy:'createdAt',direction:'desc',showEmpty:false});assert.equal(myIssueDisplay('Assigned').groupBy,'focus');assert.equal(myIssueDisplay('Activity').orderBy,'activityAt');});
test('My Issues activities resolve nested replies and reactions, ignore unrelated work and malformed comment cycles',()=>{
 const issues=entities([{id:'mine',assigneeId:'me'},{id:'other',assigneeId:'you'},{id:'unrelated'},{id:'deleted',deletedAt:'now'}]),comments=entities([{id:'root',issueId:'other'},{id:'reply',parentId:'root'},{id:'loop',parentId:'loop'}]);
 const activities=entities([{id:'a',entityId:'mine',actorId:'you',changes:{statusId:{from:'todo',to:'done'}},createdAt:'2026-01-01'},{id:'b',entityKind:'comments',entityId:'reply',actorId:'me',createdAt:'2026-01-03'},{id:'c',entityKind:'comments',entityId:'root',actorId:'me',createdAt:'2026-01-02'},{id:'d',entityId:'unrelated',actorId:'you',createdAt:'2026-01-04'},{id:'e',entityKind:'comments',entityId:'loop',actorId:'me',createdAt:'2026-01-05'},{id:'f',entityId:'deleted',actorId:'me',createdAt:'2026-01-06'}]);
 assert.deepEqual([...myIssueActivity(issues,comments,activities,'me')],[['mine','2026-01-01'],['other','2026-01-03']]);
});
test('project, initiative, triage and multiple issue palette contexts expose real actions only',()=>{
 const projects=retainedPaletteCommands({issue:false,project:true,count:2});for(const field of ['status','priority','leadId','memberIds','teamIds','labelIds','initiativeIds'])assert.ok(projects.some(row=>row.command.field===field));assert.ok(!projects.some(row=>row.command.command==='rename-project'));
 assert.ok(retainedPaletteCommands({issue:false,initiative:true}).some(row=>row.command.field==='ownerId'));
 const many=retainedPaletteCommands({issue:true,count:2,subscribed:true});assert.ok(!many.some(row=>row.command.command==='issue-description-history'));assert.ok(many.some(row=>row.label==='Unsubscribe'));
 const triage=retainedPaletteCommands({issue:true,triageId:'i'});for(const command of ['triage-accept','triage-decline','triage-duplicate','triage-snooze'])assert.ok(triage.some(row=>row.command.command===command&&row.command.value==='i'));
});
test('bulk label edits preserve mixed unrelated values, replace group siblings and carry versions for atomic writes',()=>{
 const issues=entities([{id:'a',version:3,labelIds:['common','only-a','old']},{id:'b',version:6,labelIds:['common','only-b']}]);assert.deepEqual(commonIssueValues(issues,'labelIds'),['common']);
 const changes=issueBulkPropertyChanges(issues,{labelIds:['common','new']},true,['new'],entities([{id:'new',group:'Component'},{id:'old',group:'Component'}]));
 assert.deepEqual(changes.map(c=>c.data.labelIds),[['common','only-a','new'],['common','only-b','new']]);assert.deepEqual(changes.map(c=>c.expectedVersion),[3,6]);
 assert.deepEqual(issueBulkPropertyChanges(issues,{labelIds:[]},true,['common']).map(c=>c.data.labelIds),[['only-a','old'],['only-b']]);
});
test('board edge scrolling accelerates near an edge and stops outside/inside center',()=>{assert.equal(edgeScrollVelocity(500,0,1000),0);assert.equal(edgeScrollVelocity(-1,0,1000),0);assert.equal(edgeScrollVelocity(0,0,1000),-600);assert.equal(edgeScrollVelocity(1000,0,1000),600);assert.equal(edgeScrollVelocity(975,0,1000),300);});
test('drag edge scrolling can retain full velocity just beyond a clipped collection',()=>{assert.equal(edgeScrollVelocity(1010,0,1000,50,600,40),600);assert.equal(edgeScrollVelocity(1041,0,1000,50,600,40),0);});
test('cached search honors quoted normalized words, prefixes, accents, punctuation, stopwords and state precedence',()=>{
 assert.equal(matchesSearchTokens('concatenate catch',searchTokens('"cat"')),false);assert.equal(matchesSearchTokens('cats',searchTokens('cat')),true);assert.equal(matchesSearchTokens('Café—parser',searchTokens('"cafe parser"')),true);assert.equal(matchesSearchTokens('the fox',searchTokens('"the"')),true);assert.deepEqual(searchTokens('the and'),[]);
 assert.deepEqual(['started','unstarted','backlog','triage','completed','canceled','duplicate'].map(s=>searchStatusRank(false,'issues',s)),[0,0,1,1,2,3,3]);assert.equal(searchStatusRank(true,'issues','started'),4);
});
import {commonIssueStatusOptions,resolveIssueBulkStatuses} from '../../src/client/issue-bulk-properties';
test('mixed-team bulk status choices resolve equivalent workflows per issue before the batch is submitted',()=>{
 const issues=entities([{id:'a',teamId:'one',version:1},{id:'b',teamId:'two',version:2}]),statuses=entities([{id:'a-todo',teamId:'one',type:'unstarted',name:'Todo'},{id:'b-todo',teamId:'two',type:'unstarted',name:'Todo'},{id:'a-review',teamId:'one',type:'started',name:'Review'}]);
 assert.deepEqual(commonIssueStatusOptions(issues,statuses),[{id:'a-todo',name:'Todo'}]);assert.deepEqual(resolveIssueBulkStatuses(issues,issueBulkPropertyChanges(issues,{statusId:'a-todo'}),statuses).map(c=>c.data.statusId),['a-todo','b-todo']);assert.throws(()=>resolveIssueBulkStatuses(issues,issueBulkPropertyChanges(issues,{statusId:'a-review'}),statuses),/not available in every/);
});
