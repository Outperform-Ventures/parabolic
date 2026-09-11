import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import {Repository,type Actor} from '../../src/server/repository';
test('persistent label groups survive last-label deletion, rename members, isolate scope and backfill legacy labels',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'groups@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];
 const group=repo.create(actor,'labelGroups',{name:'Empty',entityType:'projects'});assert.equal(repo.list(actor,'labelGroups').totalCount,1);
 const label=repo.create(actor,'labels',{name:'Small',labelGroupId:group.id,entityType:'projects'});assert.equal(label.group,'Empty');assert.equal(label.labelGroupId,group.id);
 repo.update(actor,'labelGroups',group.id,{name:'Size'});assert.equal(repo.get(actor,'labels',label.id).group,'Size');
 repo.update(actor,'labelGroups',group.id,{teamId:team.id});assert.equal(repo.get(actor,'labels',label.id).teamId,team.id);
 repo.update(actor,'labelGroups',group.id,{teamId:null});assert.equal(repo.get(actor,'labels',label.id).teamId,null);
 assert.throws(()=>repo.create(actor,'labelGroups',{name:'Size',entityType:'projects'}),(e:any)=>e.code==='DUPLICATE_LABEL_GROUP');
 repo.create(actor,'labelGroups',{name:'Size',entityType:'issues'});
 assert.throws(()=>repo.create(actor,'labels',{name:'Wrong type',labelGroupId:group.id}),(e:any)=>e.code==='INVALID_LABEL_GROUP');
 repo.remove(actor,'labelGroups',group.id);assert.equal(repo.raw('labels',label.id,true)?.permanentlyDeleted,true);assert.equal(repo.raw('labelGroups',group.id,true)?.permanentlyDeleted,true);assert.throws(()=>repo.restore(actor,'labelGroups',group.id),/permanently deleted/);
 const normal=repo.create(actor,'labels',{name:'Bug',group:'Type',teamId:team.id});assert.ok(normal.labelGroupId);
 const legacy=repo.create(actor,'labels',{name:'Old'});repo.save('labels',{...legacy,group:'Legacy',labelGroupId:null},'update',actor);
 const restarted=new Repository(repo.db);const restored=restarted.all('labelGroups',actor.workspaceId).find(g=>g.name==='Legacy')!;assert.ok(restored);restarted.update(actor,'labelGroups',restored.id,{name:'Renamed legacy'});assert.equal(restarted.get(actor,'labels',legacy.id).group,'Renamed legacy');
 assert.throws(()=>repo.transaction(()=>{repo.create(actor,'labels',{name:'Priority',group:'Rollback group'});}));assert.ok(!repo.all('labelGroups',actor.workspaceId).some(g=>g.name==='Rollback group'));
 assert.throws(()=>repo.create(actor,'labelGroups',{name:'Nested',parentId:group.id}),(e:any)=>e.code==='INVALID_LABEL_GROUP');
 }finally{await app.close()}
});

test('label groups are exposed through the typed SDK and GraphQL with label-scoped credentials',async()=>{
 const {ParabolicClient}=await import('../../packages/sdk/src/client');const app=createApp({databasePath:':memory:',port:0});try{const {url}=await app.start(),setup=await app.auth.setup({name:'Owner',email:'group-api@example.test',password:'label-password'}),client=new ParabolicClient({baseUrl:url,headers:{Cookie:'parabolic_session='+setup.token}}),group=await client.labelGroups.create({name:'API group',entityType:'issues'});assert.equal((await client.labelGroups.get(group.id)).name,'API group');
 const response=await fetch(url+'/graphql',{method:'POST',headers:{cookie:'parabolic_session='+setup.token,'content-type':'application/json'},body:JSON.stringify({query:'query($id:String!){labelGroup(id:$id){id name data}}',variables:{id:group.id}})});const graph=await response.json() as any;assert.equal(graph.errors,undefined);assert.equal(graph.data.labelGroup.name,'API group');
 const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['labels:read']};assert.equal(app.repo.list(actor,'labelGroups').totalCount,1);assert.throws(()=>app.repo.create(actor,'labelGroups',{name:'Denied'}));
 }finally{await app.close()}
});

test('group rename anchors stored project displays to group IDs and owns rename aliases',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({name:'Owner',email:'group-display@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,group=repo.create(actor,'labelGroups',{name:'Size',entityType:'projects',previousNames:['Forged']}),view=repo.create(actor,'views',{name:'Saved',entityType:'projects',display:{columns:['labelGroup:Size'],sort:'labelGroup:Size',group:'labelGroup:Size'},description:'labelGroup:Size'});
 assert.deepEqual(group.previousNames,[]);repo.update(actor,'labelGroups',group.id,{name:'Scale',previousNames:['Forged']});const result=repo.get(actor,'views',view.id);assert.deepEqual(result.display,{columns:['labelGroupId:'+group.id],sort:'labelGroupId:'+group.id,group:'labelGroupId:'+group.id});assert.equal(result.description,'labelGroup:Size');assert.deepEqual(repo.get(actor,'labelGroups',group.id).previousNames,['Size']);repo.update(actor,'labelGroups',group.id,{name:'Measure'});assert.deepEqual(repo.get(actor,'labelGroups',group.id).previousNames,['Size','Scale']);
 }finally{await app.close()}
});

test('label creation resolves group names without case sensitivity and preserves canonical spelling and scope',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({name:'Owner',email:'group-case@example.test',password:'label-password'}),actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0],group=repo.create(actor,'labelGroups',{name:'Product Area'});
 const label=repo.create(actor,'labels',{name:'Client',group:'product area'});assert.equal(label.group,'Product Area');assert.equal(label.labelGroupId,group.id);assert.equal(repo.all('labelGroups',actor.workspaceId).length,1);
 assert.throws(()=>repo.create(actor,'labelGroups',{name:'PRODUCT AREA'}),(e:any)=>e.code==='DUPLICATE_LABEL_GROUP');
 const teamLabel=repo.create(actor,'labels',{name:'Server',group:'product area',teamId:team.id});assert.notEqual(teamLabel.labelGroupId,group.id);
 const projectLabel=repo.create(actor,'labels',{name:'Core',group:'product area',entityType:'projects'});assert.notEqual(projectLabel.labelGroupId,group.id);
 repo.update(actor,'labelGroups',group.id,{name:'PRODUCT AREA'});assert.equal(repo.get(actor,'labels',label.id).group,'PRODUCT AREA');const legacy=repo.create(actor,'labels',{name:'Legacy case'});repo.save('labels',{...legacy,group:'product area',labelGroupId:null},'update',actor);const count=repo.all('labelGroups',actor.workspaceId).length;new Repository(repo.db);assert.equal(repo.all('labelGroups',actor.workspaceId).length,count);
 }finally{await app.close()}
});
