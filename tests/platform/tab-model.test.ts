import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceTab,recordTabVisit,moveTabHistory,normalizeTabs,rememberClosedTabs,readClosedTabs,restoreTabGroup} from '../../src/client/tab-model.ts';
test('Each tab retains its own bounded URL history and navigation branches replace only its forward entries',()=>{
 let a=createWorkspaceTab('a','/projects',1),b=createWorkspaceTab('b','/inbox',1);
 a=recordTabVisit(a,'/project/p/overview?panel=docs#one',2);a=recordTabVisit(a,'/issues/i',3);b=recordTabVisit(b,'/search?q=another',4);
 a=moveTabHistory(a,-1,5);assert.equal(a.route,'/project/p/overview?panel=docs#one');assert.equal(b.route,'/search?q=another');
 a=recordTabVisit(a,'/documents',6);assert.deepEqual(a.history,['/projects','/project/p/overview?panel=docs#one','/documents']);assert.equal(moveTabHistory(a,1),a);
 for(let i=0;i<120;i++)a=recordTabVisit(a,'/issues/'+i,10+i);assert.equal(a.history.length,100);assert.equal(a.historyIndex,99);
});
test('Closed groups retain full histories, original ordering and pin state within their account workspace scope',()=>{
 const rows=new Map<string,string>(),storage={getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>void rows.set(key,value)};
 const a=recordTabVisit(createWorkspaceTab('a','/projects'),'/project/p'),b={...createWorkspaceTab('b','/inbox'),pinned:true};
 rememberClosedTabs(storage,'workspace','person',[a,b],new Set(['a','b']),100);assert.equal(readClosedTabs(storage,'other','person').length,0);assert.equal(readClosedTabs(storage,'workspace','other').length,0);
 const group=readClosedTabs(storage,'workspace','person')[0],restored=restoreTabGroup([],group,()=> 'new',101);assert.deepEqual(restored.tabs.map(tab=>tab.id),['b','a']);assert.equal(moveTabHistory(restored.tabs[1],-1).route,'/projects');assert.equal(restored.tabs[1].lastActiveAt,101);
 const migrated=normalizeTabs([{id:'legacy',route:'/search?q=full#hash'},{id:'bad',route:'//external.test'}],'/my-issues');assert.deepEqual(migrated[0].history,['/search?q=full#hash']);
});
