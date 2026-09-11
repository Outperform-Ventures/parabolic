import {test} from 'node:test';import assert from 'node:assert/strict';
import {withIssueQuickFilter} from '../../src/shared/issue-quick-filter';
import {matchesFilter} from '../../src/client/query';
const issue=(id:string,patch:any={})=>({id,workspaceId:'w',createdAt:'',updatedAt:'',version:1,title:id,...patch});
test('relation predicates recompute from readable children and distinguish direction, duplicate and recurrence',()=>{
 const parent=issue('parent'),child=issue('child',{parentId:'parent'}),deleted=issue('deleted',{parentId:'other',deletedAt:'now'});
 assert.equal(withIssueQuickFilter(parent,[parent,child]).isParentIssue,true);
 assert.equal(withIssueQuickFilter(parent,[parent]).isParentIssue,false);
 assert.equal(withIssueQuickFilter(issue('other'),[deleted]).isParentIssue,false);
 const blocked=withIssueQuickFilter(issue('blocked',{relations:[{type:'blocked_by',issueId:'blocker'}]}));assert.equal(blocked.isBlockedIssue,true);assert.equal(blocked.isBlockingIssue,false);assert.equal(blocked.hasIssueRelations,true);
 assert.equal(withIssueQuickFilter(issue('duplicate',{duplicateOfId:'parent'})).isDuplicateIssue,true);
 assert.equal(withIssueQuickFilter(issue('repeat',{recurrence:{frequency:'weekly'}})).isRecurringIssue,true);
 assert.equal(matchesFilter(child,{match:'all',conditions:[{field:'isSubIssue',operator:'eq',value:true},{field:'isParentIssue',operator:'eq',value:true}]},undefined,undefined,undefined,undefined,undefined,[parent,child]),false);
});
test('content matches title and rendered description text, excluding markup attributes',()=>{
 const row=issue('Example',{description:'<p title="hidden-attribute">Cr&egrave;me &amp; sugar</p>'});
 const match=(value:string)=>matchesFilter(row,{match:'all',conditions:[{field:'searchableContent',operator:'contains',value}]});
 assert.equal(match('crème & sugar'),true);assert.equal(match('hidden-attribute'),false);assert.equal(match('example'),true);
 assert.equal(withIssueQuickFilter(issue('rich',{description:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Rich body'}]}]}})).searchableContent.trim(),'rich Rich body');
});
