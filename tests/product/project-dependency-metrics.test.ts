import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProjectDependencyMetrics,usesProjectDependencyMetrics} from '../../src/shared/project-dependency-metrics';
import type {Entity} from '../../src/shared/types';
const e=(id:string,fields:Record<string,any>={}):Entity=>({id,workspaceId:'w',version:1,createdAt:'2026-01-01',updatedAt:'2026-01-01',...fields});
test('dependency metrics mark both ends, honor date fallback and ignore unavailable edges',()=>{
 const data={projects:[e('a',{targetDate:'2026-02-02'}),e('b',{dependencyIds:['a','a','missing','archived'],targetDate:'2026-02-01'}),e('c'),e('archived',{archivedAt:'2026-01-01',dependencyIds:['c']})],issues:[],activities:[],statuses:[],teams:[]};
 let metrics=buildProjectDependencyMetrics(data);assert.equal(metrics.get('a')!.hasBlockingDependency,true);assert.equal(metrics.get('a')!.hasBlockedByDependency,false);assert.equal(metrics.get('b')!.hasBlockedByDependency,true);assert.equal(metrics.get('a')!.hasViolatedDependencies,true);assert.equal(metrics.get('b')!.hasViolatedDependencies,true);assert.equal(metrics.get('c')!.hasDependencies,false);assert.equal(metrics.has('archived'),false);
 data.projects[1].startDate='2026-02-02';metrics=buildProjectDependencyMetrics(data);assert.equal(metrics.get('b')!.hasViolatedDependencies,false);assert(usesProjectDependencyMetrics({and:[{hasDependencies:{eq:true}}]}));
});
test('missing blocker target uses progress forecast, while unknown dates do not manufacture violations',()=>{
 const now=Date.parse('2026-01-15'),data={projects:[e('a'),e('b',{dependencyIds:['a'],startDate:'2026-01-14'})],issues:[e('done',{projectId:'a',statusId:'done',estimate:1}),e('todo',{projectId:'a',statusId:'todo',estimate:2})],activities:[e('activity',{entityKind:'issues',entityId:'done',createdAt:'2026-01-12',changes:{statusId:{from:'todo',to:'done'}}})],statuses:[e('done',{type:'completed'}),e('todo',{type:'unstarted'})],teams:[]};
 assert.equal(buildProjectDependencyMetrics(data,now).get('b')!.hasViolatedDependencies,true);assert.equal(buildProjectDependencyMetrics({...data,issues:[],activities:[]},now).get('b')!.hasViolatedDependencies,false);
});
