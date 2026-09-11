import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPropertyIndex,withProjectProperties,usesProjectProperties} from '../../src/shared/project-property-filter';
import {matchesFilter} from '../../src/client/query';
import type {Entity} from '../../src/shared/types';
const entity=(id:string,values:Record<string,unknown>={}):Entity=>({id,workspaceId:'w',createdAt:'2026-01-01',updatedAt:'2026-01-01',version:1,...values});
test('project filter values distinguish no project from an unlabeled priority-zero project',()=>{
 const projects=[entity('p',{status:'started',priority:0,leadId:'u'})],issues=[entity('a',{projectId:'p'}),entity('b')];
 const index=projectPropertyIndex(projects,[]);
 assert.equal(withProjectProperties(issues[0],index).projectLabelCount,0);
 assert.equal(withProjectProperties(issues[1],index).projectLabelCount,null);
 const filter=(field:string,value:unknown)=>({conditions:[{field,operator:'in',value:[value]}]});
 assert.equal(matchesFilter(issues[0],filter('projectPriority',0),[],projects),true);
 assert.equal(matchesFilter(issues[1],filter('projectPriority',0),[],projects),false);
 assert.equal(matchesFilter(issues[1],filter('projectLeadId',null),[],projects),true);
 assert.equal(matchesFilter(issues[0],filter('projectLeadId','@current-user'),[],projects,undefined,undefined,'u'),true);
 assert.equal(matchesFilter(issues[0],filter('projectLeadId','@current-user'),[],projects,undefined,undefined,'other'),false);
 assert.equal(matchesFilter(issues[0],filter('projectStatus','started'),[],projects),true);
});
test('milestone matching uses the assigned milestone, is case insensitive, and excludes inaccessible or mismatched records',()=>{
 const projects=[entity('p')],milestones=[entity('m',{projectId:'p',name:'Launch Alpha'}),entity('wrong',{projectId:'hidden',name:'Launch Alpha'})];
 const condition={conditions:[{field:'milestoneName',operator:'contains',value:'LAUNCH'}]};
 const matches=(id:string,visible=milestones)=>matchesFilter(entity('i',{projectId:'p',milestoneId:id}),condition,[],projects,undefined,undefined,undefined,undefined,visible);
 assert.equal(matches('m'),true);assert.equal(matches('wrong'),false);assert.equal(matches('m',[]),false);
 const index=projectPropertyIndex(projects,[],milestones);
 assert.equal(withProjectProperties(entity('i',{projectId:'other',milestoneId:'m'}),index).milestoneName,null);
 assert.equal(usesProjectProperties({groups:[{conditions:[{field:'milestoneName',operator:'contains',value:'Launch'}]}]}),true);
});
