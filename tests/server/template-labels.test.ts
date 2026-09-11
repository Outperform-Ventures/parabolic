import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';
test('templates omit archived default labels from roots and nested work without rewriting configuration',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'template-labels@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
 const old=repo.create(actor,'labels',{name:'Old'}),keep=repo.create(actor,'labels',{name:'Keep'}),oldProject=repo.create(actor,'labels',{name:'Old project',entityType:'projects'}),keepProject=repo.create(actor,'labels',{name:'Keep project',entityType:'projects'}),template=repo.create(actor,'templates',{name:'Issue defaults',type:'issue',properties:{labelIds:[old.id,keep.id]},subIssues:[{title:'Child',properties:{labelIds:[old.id,keep.id]},subIssues:[{title:'Grandchild',properties:{labelIds:[old.id]}}]}]}),projectTemplate=repo.create(actor,'templates',{name:'Project defaults',type:'project',properties:{labelIds:[oldProject.id,keepProject.id]},projectPlan:{issues:[{title:'Planned child',labelIds:[old.id,keep.id]}]}});
 repo.update(actor,'labels',old.id,{archivedAt:new Date().toISOString()});repo.update(actor,'labels',oldProject.id,{archivedAt:new Date().toISOString()});
 const issue=repo.create(actor,'issues',{title:'Template root',teamId:team.id,templateId:template.id});assert.deepEqual(issue.labelIds,[keep.id]);const child=repo.all('issues',actor.workspaceId).find(i=>i.parentId===issue.id)!;assert.deepEqual(child.labelIds,[keep.id]);assert.deepEqual(repo.all('issues',actor.workspaceId).find(i=>i.parentId===child.id)!.labelIds,[]);
 const project=repo.create(actor,'projects',{name:'Template project',teamId:team.id,templateId:projectTemplate.id});assert.deepEqual(project.labelIds,[keepProject.id]);assert.deepEqual(repo.all('issues',actor.workspaceId).find(i=>i.projectId===project.id)!.labelIds,[keep.id]);assert.deepEqual(repo.get(actor,'templates',template.id).properties.labelIds,[old.id,keep.id]);assert.deepEqual(repo.get(actor,'templates',projectTemplate.id).properties.labelIds,[oldProject.id,keepProject.id]);
 assert.throws(()=>repo.create(actor,'issues',{title:'Explicit retired selection',teamId:team.id,templateId:template.id,labelIds:[old.id]}),(e:any)=>e.code==='ARCHIVED_LABEL');repo.update(actor,'labels',old.id,{archivedAt:null});assert.deepEqual(repo.create(actor,'issues',{title:'Restored default',teamId:team.id,templateId:template.id}).labelIds,[old.id,keep.id]);
 }finally{await app.close()}
});

test('converted group references are skipped by issue and project templates and resume after conversion back',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'converted-template@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},team=repo.all('teams',actor.workspaceId)[0];
 const label=repo.create(actor,'labels',{name:'Convertible default'}),projectLabel=repo.create(actor,'labels',{name:'Convertible project default',entityType:'projects'}),keep=repo.create(actor,'labels',{name:'Keep default'});
 const template=repo.create(actor,'templates',{name:'Convertible issue defaults',type:'issue',properties:{labelIds:[label.id,keep.id]},subIssues:[{title:'Nested default',properties:{labelIds:[label.id]},subIssues:[{title:'Deep default',labelIds:[label.id]}]}]});
 const projectTemplate=repo.create(actor,'templates',{name:'Convertible project defaults',type:'project',properties:{labelIds:[projectLabel.id]},projectPlan:{issues:[{title:'Planned default',labelIds:[label.id,keep.id]}]}});
 const before=structuredClone(repo.get(actor,'templates',template.id)),projectBefore=structuredClone(repo.get(actor,'templates',projectTemplate.id));
 for(const value of [label,projectLabel])repo.update(actor,'labels',value.id,{convertTo:'labelGroups'});
 assert.throws(()=>repo.create(actor,'issues',{title:'Explicit group assignment',teamId:team.id,templateId:template.id,labelIds:[label.id]}),(e:any)=>e.code==='INVALID_REFERENCE');
 const issue=repo.create(actor,'issues',{title:'After conversion',teamId:team.id,templateId:template.id});assert.deepEqual(issue.labelIds,[keep.id]);const child=repo.all('issues',actor.workspaceId).find(i=>i.parentId===issue.id)!;assert.deepEqual(child.labelIds,[]);assert.deepEqual(repo.all('issues',actor.workspaceId).find(i=>i.parentId===child.id)!.labelIds,[]);
 const project=repo.create(actor,'projects',{name:'After project conversion',teamId:team.id,templateId:projectTemplate.id});assert.deepEqual(project.labelIds,[]);assert.deepEqual(repo.all('issues',actor.workspaceId).find(i=>i.projectId===project.id)!.labelIds,[keep.id]);
 assert.deepEqual(repo.get(actor,'templates',template.id),before);assert.deepEqual(repo.get(actor,'templates',projectTemplate.id),projectBefore);
 for(const value of [label,projectLabel])repo.update(actor,'labelGroups',value.id,{convertTo:'labels'});
 assert.deepEqual(repo.create(actor,'issues',{title:'Restored issue default',teamId:team.id,templateId:template.id}).labelIds,[label.id,keep.id]);assert.deepEqual(repo.create(actor,'projects',{name:'Restored project default',teamId:team.id,templateId:projectTemplate.id}).labelIds,[projectLabel.id]);
 }finally{await app.close()}
});
