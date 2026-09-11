import {ensureDuplicateStatus} from '../../src/server/workflow-statuses';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';
test('closed parent/sub-issue categories follow current native policy regardless of closure order',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'substates@example.test',name:'Owner',password:'substates-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
  repo.update(actor,'teams',team.id,{autoCloseSubIssues:true,autoCloseParentIssues:true});
  const status=(type:string)=>repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type===type)!.id;
  ensureDuplicateStatus(repo,actor,team.id);
  const create=(title:string,parentId?:string,type='unstarted')=>repo.create(actor,'issues',{title,teamId:team.id,parentId,statusId:status(type)});
  for(const first of ['completed','canceled','duplicate'])for(const last of ['completed','canceled','duplicate']){
   const parent=create('Parent '+first+' '+last),a=create('First child',parent.id),b=create('Last child',parent.id);
   repo.update(actor,'issues',a.id,{statusId:status(first)});assert.equal(repo.raw('issues',parent.id)?.statusId,status('unstarted'));
   repo.update(actor,'issues',b.id,{statusId:status(last)});assert.equal(repo.raw('issues',parent.id)?.statusId,status('completed'));assert.equal(repo.raw('issues',a.id)?.statusId,status(first));assert.equal(repo.raw('issues',b.id)?.statusId,status(last));
  }
  for(const parentCategory of ['completed','canceled','duplicate'])for(const childCategory of ['completed','canceled','duplicate']){
   const parent=create('Closing parent '+parentCategory),closed=create('Already closed child',parent.id,childCategory),open=create('Open child',parent.id);
   repo.update(actor,'issues',parent.id,{statusId:status(parentCategory)});assert.equal(repo.raw('issues',open.id)?.statusId,status('completed'));assert.equal(repo.raw('issues',closed.id)?.statusId,status(childCategory));assert.equal(repo.raw('issues',parent.id)?.statusId,status(parentCategory));
  }
 }finally{await app.close()}
});

test('parent and child auto-close toggles act independently in all four configurations',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({email:'toggle-matrix@example.test',name:'Owner',password:'toggle-matrix-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0],status=(type:string)=>repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type===type)!.id;
  for(const autoCloseParentIssues of [false,true])for(const autoCloseSubIssues of [false,true]){
   repo.update(actor,'teams',team.id,{autoCloseParentIssues,autoCloseSubIssues});
   const parent=repo.create(actor,'issues',{title:'Parent child-trigger',teamId:team.id,statusId:status('unstarted')}),child=repo.create(actor,'issues',{title:'Child trigger',teamId:team.id,parentId:parent.id,statusId:status('unstarted')}),sibling=repo.create(actor,'issues',{title:'Other child',teamId:team.id,parentId:parent.id,statusId:status('unstarted')});
   repo.update(actor,'issues',child.id,{statusId:status('completed')});assert.equal(repo.raw('issues',parent.id)?.statusId,status('unstarted'));
   repo.update(actor,'issues',sibling.id,{statusId:status('completed')});assert.equal(repo.raw('issues',parent.id)?.statusId,status(autoCloseParentIssues?'completed':'unstarted'));
   const next=repo.create(actor,'issues',{title:'Parent trigger',teamId:team.id,statusId:status('unstarted')}),nextChild=repo.create(actor,'issues',{title:'Receiving child',teamId:team.id,parentId:next.id,statusId:status('unstarted')});
   repo.update(actor,'issues',next.id,{statusId:status('completed')});assert.equal(repo.raw('issues',nextChild.id)?.statusId,status(autoCloseSubIssues?'completed':'unstarted'));
  }
 }finally{await app.close()}
});
