import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleFilterSelection,toggleFilterSelections,selectedCondition,selectedValues,selectionOperatorName,categoricalFilterFields,unwrapIssueFilter} from '../../src/client/issue-filter-selection';
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
test('all categorical fields support adding, removing and clearing multiple values without moving other filters',()=>{
 for(const field of [...categoricalFilterFields,'labelIds','projectLabelIds']){
  const sibling={field:'unrelated',operator:'eq',value:'keep'};
  const original:FilterSpec={match:'all',conditions:[{field,operator:'in',value:['a']},sibling],groups:[{match:'any',conditions:[]}]};
  const added=toggleFilterSelection(original,field,'b');
  assert.deepEqual(added.conditions,[{field,operator:'in',value:['a','b']},sibling],field);
  assert.equal(added.groups,original.groups);
  const removed=toggleFilterSelection(added,field,'a');
  assert.deepEqual(removed.conditions,[{field,operator:'in',value:['b']},sibling],field);
  assert.deepEqual(toggleFilterSelection(removed,field,'b').conditions,[sibling],field);
  assert.deepEqual(original.conditions[0].value,['a']);
 }
});
test('grouped workspace statuses toggle together and preserve the chip position',()=>{
 const sibling={field:'priority',operator:'in',value:[2]};
 const original:FilterSpec={match:'all',conditions:[{field:'statusId',operator:'in',value:['todo-1']},sibling]};
 const todos=toggleFilterSelections(original,'statusId',['todo-1','todo-2']);
 const both=toggleFilterSelections(todos,'statusId',['done-1','done-2']);
 assert.deepEqual(both.conditions,[{field:'statusId',operator:'in',value:['todo-1','todo-2','done-1','done-2']},sibling]);
 assert.deepEqual(toggleFilterSelections(both,'statusId',['todo-1','todo-2']).conditions,[{field:'statusId',operator:'in',value:['done-1','done-2']},sibling]);
});
test('saved-view wrapper groups expose selections without changing scope or boolean matching',()=>{
 for(const match of ['all','any'] as const){
  const selected:FilterSpec={match,conditions:[{field:'priority',operator:'in',value:[1,2]},{field:'assigneeId',operator:'in',value:['a','b']}]};
  const wrapped:FilterSpec={match:'all',conditions:[],groups:[{match:'all',conditions:[],groups:[selected]}]};
  assert.equal(unwrapIssueFilter(wrapped),selected);
  for(const priority of [1,3])for(const assigneeId of ['a','c'])assert.equal(matchesFilter({priority,assigneeId} as any,wrapped),matchesFilter({priority,assigneeId} as any,unwrapIssueFilter(wrapped)));
  const scoped={...wrapped,conditions:[{field:'teamId',operator:'eq',value:'team'}]};
  assert.equal(unwrapIssueFilter(scoped),scoped);
  const branches={...wrapped,groups:[selected,selected]};assert.equal(unwrapIssueFilter(branches),branches);
 }
});
