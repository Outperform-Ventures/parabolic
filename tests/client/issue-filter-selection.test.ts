import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleFilterSelection,selectedCondition,selectedValues,selectionOperatorName} from '../../src/client/issue-filter-selection';
import {matchesFilter,type FilterSpec} from '../../src/client/query';
test('editing an existing exclusion preserves its semantics and removes the final selection',()=>{
 const original:FilterSpec={match:'all',conditions:[{field:'priority',operator:'neq',value:2},{field:'teamId',operator:'in',value:['t']}]};
 const added=toggleFilterSelection(original,'priority',1),condition=selectedCondition(added,'priority')!;
 assert.deepEqual(selectedValues(condition),[2,1]);assert.equal(condition.operator,'none');assert.equal(selectionOperatorName(condition),'is not');
 for(const priority of [1,2])assert.equal(matchesFilter({priority,teamId:'t'} as any,added),false);
 assert.equal(matchesFilter({priority:4,teamId:'t'} as any,added),true);
 const removed=toggleFilterSelection(toggleFilterSelection(added,'priority',1),'priority',2);
 assert.deepEqual(removed.conditions,[original.conditions[1]]);assert.equal(original.conditions[0].operator,'neq');
});
test('adding a value to scalar equality becomes multi-selection; label all remains all',()=>{
 const equality:FilterSpec={match:'all',conditions:[{field:'priority',operator:'eq',value:2}]};
 const condition=selectedCondition(toggleFilterSelection(equality,'priority',1),'priority')!;
 assert.equal(condition.operator,'in');assert.equal(selectionOperatorName(condition),'is any of');
 const labels:FilterSpec={match:'all',conditions:[{field:'labelIds',operator:'all',value:['a']}]};
 assert.equal(selectedCondition(toggleFilterSelection(labels,'labelIds','b'),'labelIds')?.operator,'all');
});
