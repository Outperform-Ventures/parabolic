import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import {searchEntities} from '../../src/server/search';import type {Actor} from '../../src/server/repository';
test('online search filters linked project properties and milestones before returning matches',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
  const setup=await app.auth.setup({name:'Owner',email:'online-project@example.test',password:'owner-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
  const project=repo.create(actor,'projects',{name:'Project',teamIds:[team.id],priority:2,leadId:actor.userId}),milestone=repo.create(actor,'milestones',{name:'Launch Alpha',projectId:project.id});
  const issue=repo.create(actor,'issues',{title:'Needle launch',teamId:team.id,projectId:project.id,milestoneId:milestone.id});repo.create(actor,'issues',{title:'Needle other',teamId:team.id});
  for(const [field,operator,value] of [['milestoneName','contains','ALPHA'],['projectPriority','in',[2]],['projectLeadId','in',['@current-user']]])assert.deepEqual(searchEntities(repo,actor,'Needle',{kinds:['issues'],filter:{conditions:[{field,operator,value}]}}).nodes.map(i=>i.id),[issue.id]);
  repo.update(actor,'milestones',milestone.id,{name:'Renamed'});assert.equal(searchEntities(repo,actor,'Needle',{kinds:['issues'],filter:{conditions:[{field:'milestoneName',operator:'contains',value:'ALPHA'}]}}).totalCount,0);
 }finally{await app.close()}
});
