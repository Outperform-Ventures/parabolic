import test from 'node:test';import assert from 'node:assert/strict';
import {matchesFilter,expandLabelFilter} from '../../src/client/query';
import {projectLabelIndex,usesProjectLabels} from '../../src/shared/project-label-filter';
import type {Entity} from '../../src/shared/types';
test('project label filters use current readable metadata and keep issue labels distinct',()=>{
 const labels=[{id:'p',name:'Large',entityType:'projects'},{id:'same',name:'Large',entityType:'projects'},{id:'issue',name:'Large',entityType:'issues'},{id:'deleted',entityType:'projects',deletedAt:'today'}] as unknown as Entity[];
 const projects=[{id:'parent',labelIds:['p','p','deleted','issue']}] as unknown as Entity[],issue={id:'i',projectId:'parent',labelIds:['issue']} as unknown as Entity;
 const filter={conditions:[{field:'projectLabelIds',operator:'eq',value:'same'}],match:'all' as const};
 assert.deepEqual(projectLabelIndex(projects,labels).get('parent'),['p']);
 assert.equal(matchesFilter(issue,filter,labels,projects),true);
 assert.equal(matchesFilter(issue,filter,labels,[]),false);
 assert.equal(matchesFilter(issue,{...filter,conditions:[{...filter.conditions[0],value:'issue'}]},labels,projects),false);
 assert.equal(matchesFilter(issue,{...filter,conditions:[{...filter.conditions[0],operator:'neq'}]},labels,projects),false);
 assert.equal(matchesFilter(issue,filter,labels,[{...projects[0],labelIds:[]}]),false);
 assert.equal(usesProjectLabels(expandLabelFilter(filter,labels)),true);
 assert.equal(usesProjectLabels({labelIds:{eq:'p'}}),false);
});
