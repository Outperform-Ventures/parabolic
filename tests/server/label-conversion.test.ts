import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor,RecordEntity} from '../../src/server/repository';

test('unused labels and empty groups convert atomically with stable identity, metadata and monotonically increasing versions',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();try{
 const setup=await app.auth.setup({name:'Owner',email:'convert-label@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']};
 for(const entityType of ['issues','projects']){
 const label=repo.create(actor,'labels',{name:'Convertible '+entityType,description:'Retain context',color:'#ff6600',entityType});
 let kind:'labels'|'labelGroups'='labels';let current:RecordEntity=label;
 for(let i=0;i<4;i++){
  const to:'labels'|'labelGroups'=kind==='labels'?'labelGroups':'labels';const before=Number((repo.db.prepare('SELECT MAX(seq) AS n FROM changes').get() as any).n);
  const response:Response=await fetch(url+'/api/v1/'+kind+'/'+current.id,{method:'PATCH',headers:{cookie:'parabolic_session='+setup.token,'content-type':'application/json'},body:JSON.stringify({convertTo:to,version:current.version})});assert.equal(response.status,200);
  const deleted:RecordEntity=await response.json();assert.ok(deleted.deletedAt);assert.equal(repo.raw(kind,current.id),null);
  const next:RecordEntity=repo.get(actor,to,current.id);assert.equal(next.id,label.id);assert.equal(next.name,label.name);assert.equal(next.description,label.description);assert.equal(next.color,label.color);assert.equal(next.createdAt,label.createdAt);assert.equal(next.entityType,entityType);assert.ok(next.version>current.version);assert.equal(next.convertTo,undefined);assert.equal(next.convertedTo,undefined);
  const changes=repo.db.prepare('SELECT kind,action FROM changes WHERE seq>? AND entity_id=?').all(before,label.id) as any[];assert.ok(changes.some(c=>c.kind===kind&&c.action==='delete'));assert.ok(changes.some(c=>c.kind===to&&['create','update'].includes(c.action)));
  assert.throws(()=>repo.restore(actor,kind,current.id),(e:any)=>e.code==='PERMANENTLY_DELETED');
  kind=to;current=next;
 }
 }
 }finally{await app.close()}
});

test('label conversion rejects assignments, triage references, nested labels, populated groups, stale versions and collisions without partial writes',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'convert-protection@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},team=repo.all('teams',actor.workspaceId)[0];
 const reject=(kind:'labels'|'labelGroups',id:string,code:string,extra={})=>{const snapshot=structuredClone(repo.get(actor,kind,id)),seq=(repo.db.prepare('SELECT MAX(seq) AS n FROM changes').get() as any).n;assert.throws(()=>repo.update(actor,kind,id,{convertTo:kind==='labels'?'labelGroups':'labels',...extra}),(e:any)=>e.code===code);assert.deepEqual(repo.get(actor,kind,id),snapshot);assert.equal((repo.db.prepare('SELECT MAX(seq) AS n FROM changes').get() as any).n,seq);};
 for(const type of ['issues','projects']){const label=repo.create(actor,'labels',{name:'Assigned '+type,entityType:type});repo.create(actor,type,type==='issues'?{title:'Uses label',teamId:team.id,labelIds:[label.id]}:{name:'Uses label',teamIds:[team.id],labelIds:[label.id]});reject('labels',label.id,'LABEL_CONVERSION_IN_USE');}
 const label=repo.create(actor,'labels',{name:'Rule input'});repo.create(actor,'automations',{name:'Routing input',type:'routing',teamId:team.id,filter:{match:'all',conditions:[{field:'labelIds',operator:'contains',value:label.id}]},set:{priority:2}});reject('labels',label.id,'LABEL_CONVERSION_IN_USE');
 const output=repo.create(actor,'labels',{name:'Rule output'});repo.create(actor,'automations',{name:'Routing output',type:'routing',teamId:team.id,filter:{match:'all',conditions:[]},set:{labelIds:[output.id]}});reject('labels',output.id,'LABEL_CONVERSION_IN_USE');
 const group=repo.create(actor,'labelGroups',{name:'Group'}),child=repo.create(actor,'labels',{name:'Child',labelGroupId:group.id});reject('labels',child.id,'LABEL_CONVERSION_IN_USE');reject('labelGroups',group.id,'LABEL_CONVERSION_IN_USE');
 const conflict=repo.create(actor,'labels',{name:'Collision'});repo.create(actor,'labelGroups',{name:'Collision'});reject('labels',conflict.id,'DUPLICATE_LABEL_GROUP');
 const unused=repo.create(actor,'labels',{name:'Unused'});reject('labels',unused.id,'VERSION_CONFLICT',{version:unused.version-1});reject('labels',unused.id,'INVALID_LABEL_CONVERSION',{name:'Renamed'});
 assert.throws(()=>repo.update({...actor,role:'member',scopes:['read']},'labels',unused.id,{convertTo:'labelGroups'}),(e:any)=>e.status===403);
 }finally{await app.close()}
});
