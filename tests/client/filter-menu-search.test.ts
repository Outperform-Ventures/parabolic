import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesMenuSearch} from '../../src/client/filter-menu-search';
import {issueRecurringSeriesId,withIssueQuickFilter} from '../../src/shared/issue-quick-filter';
import {matchesFilter} from '../../src/client/query';
test('native abbreviated searches match labels without propagating fuzzy parent matches',()=>{
 assert.equal(matchesMenuSearch('Assignee','asg'),true);
 assert.equal(matchesMenuSearch('No assignee','asg','Assignee'),true);
 assert.equal(matchesMenuSearch('Current user','asg','Assignee'),false);
 assert.equal(matchesMenuSearch('3 days ago','asg','Dates Created date'),true);
 assert.equal(matchesMenuSearch('Custom date or timeframe…','Customer tier','Dates Due date'),true);
 assert.equal(matchesMenuSearch('Overdue','Dates','Dates Due date'),true);
 assert.equal(matchesMenuSearch('Current user','unmatchable_zzzz','Assignee'),false);
});
test('recurring series filters follow readable occurrence chains and distinguish ordinary issues',()=>{
 const row=(id:string,patch:any={})=>({id,title:id,workspaceId:'w',createdAt:'',updatedAt:'',version:1,...patch});
 const root=row('root',{recurrence:{frequency:'weekly'}}),next=row('next',{recurrenceSourceId:'root'}),last=row('last',{recurrenceSourceId:'next'}),ordinary=row('ordinary'),issues=[root,next,last,ordinary];
 for(const issue of [root,next,last]){
  assert.equal(issueRecurringSeriesId(issue,issues),'root');
  assert.equal(matchesFilter(issue,{match:'all',conditions:[{field:'recurringSeriesId',operator:'in',value:['root']}]},undefined,undefined,undefined,undefined,undefined,issues),true);
 }
 assert.equal(issueRecurringSeriesId(ordinary,issues),null);
 assert.equal(withIssueQuickFilter(next,issues).isRecurringIssue,true);
 assert.equal(matchesFilter(ordinary,{match:'all',conditions:[{field:'recurringSeriesId',operator:'in',value:[null]}]},undefined,undefined,undefined,undefined,undefined,issues),true);
 assert.equal(issueRecurringSeriesId(last,[last]),'last');
});
