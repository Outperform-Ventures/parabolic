import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {createCustomerNeed,updateCustomerNeed,getIssueAttachment,getProjectAttachment} from '../../src/server/customer-needs';
import {purgeExpiredTrash} from '../../src/server/lifecycle';
import type {Actor,RecordEntity} from '../../src/server/repository';
import {ParabolicClient} from '../../packages/sdk/src/client';
import {initializeRequestSources} from '../../src/server/issue-attachments';
import {existsSync} from 'node:fs';

const schemaFixture='reference/parabolic-api/schema.graphql';

async function fixture(){const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start(),setup=await app.auth.setup({name:'Need owner',email:'need-owner@example.test',password:'Customer-need-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin']},repo=app.repo,team=repo.all('teams',actor.workspaceId)[0],issue=repo.create(actor,'issues',{title:'Customer feedback',teamId:team.id});const sdk=new ParabolicClient({baseUrl:url,headers:{cookie:`parabolic_session=${setup.token}`}});return {app,repo,actor,issue,sdk};}
test('documented customerNeedCreate persists customer external identity, Markdown and a queryable stable source attachment',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,customer=repo.create(actor,'customers',{name:'ACME',externalIds:['crm-123']});
  const result=await sdk.customerNeedCreate({issueId:issue.id,customerExternalId:'crm-123',priority:1,body:'## Feedback\n\nPlease add **exports** and [context](https://example.test/context).\n\n- First\n- Second',attachmentUrl:'https://example.test/feedback/123'});
  assert.equal(result.success,true);const need=result.need;assert.equal(need.customerId,customer.id);assert.equal(need.priority,1);assert.match(need.body!,/\*\*exports\*\*/);assert.match(need.body!,/## Feedback/);assert.match(need.body!,/\[context\]\(https:\/\/example.test\/context\)/);
  const stored=repo.get(actor,'requests',need.id);assert.equal(stored.important,true);assert.match(stored.body,/<strong>exports<\/strong>/);assert.equal(stored.sourceUrl,need.attachment!.url);
  const queried=await sdk.graphql<any>('query($id:String!){attachment(id:$id){id url issue{id title}}}',{id:need.attachment!.id});assert.equal(queried.attachment.issue.id,issue.id);
  const second=await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:need.attachment!.url});assert.equal(second.need.attachment!.id,need.attachment!.id);assert.equal(second.need.customerId,null);assert.equal(second.need.priority,0);
  const third=await sdk.customerNeedCreate({issueId:issue.id,customerId:customer.id,attachmentId:need.attachment!.id});assert.equal(third.need.attachment!.id,need.attachment!.id);assert.equal(repo.all('requests',actor.workspaceId).length,3);
  repo.update(actor,'requests',need.id,{body:'<p>Changed <strong>after creation</strong></p>',important:false});const updated=await sdk.graphql<any>('query($id:String!){customerNeed(id:$id){body priority attachment{id}}}',{id:need.id});assert.equal(updated.customerNeed.body,'Changed **after creation**');assert.equal(updated.customerNeed.priority,0);
  repo.update(actor,'requests',need.id,{sourceUrl:'https://example.test/new'});const detached=await sdk.graphql<any>('query($id:String!){customerNeed(id:$id){attachment{id}}}',{id:need.id});assert.notEqual(detached.customerNeed.attachment.id,need.attachment!.id);assert.equal(getIssueAttachment(repo,actor,detached.customerNeed.attachment.id).url,'https://example.test/new');
 }finally{await f.app.close();}
});
test('customer needs reject invalid or inaccessible identities and attachments without leaving partial writes',async()=>{
 const f=await fixture();try{const {repo,actor,issue}=f,count=()=>({requests:repo.all('requests',actor.workspaceId).length,attachments:Number((repo.db.prepare('SELECT count(*) AS count FROM issue_attachments').get() as any).count)});
  for(const fields of [{priority:2},{customerExternalId:'unknown'},{customerExternalId:''},{customerId:'one',customerExternalId:'two'},{attachmentUrl:'javascript:alert(1)'},{attachmentUrl:'https://user:pass@example.test/'},{attachmentId:'missing'},{body:5}]){assert.throws(()=>createCustomerNeed(repo,actor,{issueId:issue.id,...fields}));assert.deepEqual(count(),{requests:0,attachments:0});}
  assert.throws(()=>createCustomerNeed(repo,{...actor,scopes:['read']},{issueId:issue.id}),/scope/);
  const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Other').workspaceId};repo.create(foreign,'customers',{name:'Foreign',externalIds:['foreign-crm']});assert.throws(()=>createCustomerNeed(repo,actor,{issueId:issue.id,customerExternalId:'foreign-crm'}),/not found/);
  const need=createCustomerNeed(repo,actor,{issueId:issue.id,attachmentUrl:'https://example.test/shared'}),other=repo.create(actor,'issues',{title:'Other issue',teamId:issue.teamId});
  assert.throws(()=>createCustomerNeed(repo,actor,{issueId:other.id,attachmentId:need.attachmentId}),/another issue/);assert.throws(()=>getIssueAttachment(repo,foreign,need.attachmentId),/not found/);
  const before=count(),original=repo.create;repo.create=()=>{throw new Error('Simulated request persistence failure')};try{assert.throws(()=>createCustomerNeed(repo,actor,{issueId:issue.id,attachmentUrl:'https://example.test/rolled-back'}),/persistence failure/);}finally{repo.create=original;}assert.deepEqual(count(),before);
 }finally{await f.app.close();}
});
test('customer need bodies sanitize active HTML and attachments follow issue deletion, restoration and permanent purge',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f;
  const result=await sdk.customerNeedCreate({issueId:issue.id,body:'<script>alert(1)</script>\n\n[unsafe](javascript:alert)\n\n**Safe**',attachmentUrl:'https://example.test/source'});const need=result.need,body=repo.get(actor,'requests',need.id).body;assert.doesNotMatch(body,/<script|javascript:/);assert.match(need.body!,/\*\*Safe\*\*/);
  repo.remove(actor,'issues',issue.id);assert.throws(()=>getIssueAttachment(repo,actor,need.attachment!.id),/not found/);repo.restore(actor,'issues',issue.id);assert.equal(getIssueAttachment(repo,actor,need.attachment!.id).issueId,issue.id);
  repo.remove(actor,'issues',issue.id);purgeExpiredTrash(repo,actor,new Date(Date.now()+32*86400000));assert.equal(repo.db.prepare('SELECT id FROM issue_attachments WHERE id=?').get(need.attachment!.id),undefined);
 }finally{await f.app.close();}
});
test('all request writes derive source attachments across URL edits, issue moves, clearing and undo',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,sourceUrl='https://example.test/ordinary-request',first=repo.create(actor,'requests',{title:'App request',issueId:issue.id,sourceUrl,attachmentId:'forged-id'});
  assert.notEqual(first.attachmentId,'forged-id');assert.equal(getIssueAttachment(repo,actor,first.attachmentId).url,sourceUrl);
  const read=await sdk.graphql<any>('query($id:String!){customerNeed(id:$id){attachmentId attachment{id url} creatorId}}',{id:first.id});assert.equal(read.customerNeed.attachmentId,first.attachmentId);assert.equal(read.customerNeed.creatorId,actor.userId);
  const duplicate=repo.create(actor,'requests',{title:'Another request',issueId:issue.id,sourceUrl});assert.equal(duplicate.attachmentId,first.attachmentId);
  const edited=repo.update(actor,'requests',first.id,{sourceUrl:'https://example.test/edited'});assert.notEqual(edited.attachmentId,first.attachmentId);
  const otherIssue=repo.create(actor,'issues',{title:'Moved target',teamId:issue.teamId});const moved=repo.update(actor,'requests',first.id,{issueId:otherIssue.id});assert.equal(moved.attachmentId,edited.attachmentId);assert.equal(getIssueAttachment(repo,actor,moved.attachmentId).issueId,otherIssue.id);
  const undone=repo.update(actor,'requests',first.id,{issueId:issue.id,sourceUrl});assert.equal(undone.attachmentId,first.attachmentId);
  const cleared=repo.update(actor,'requests',first.id,{sourceUrl:''});assert.equal(cleared.attachmentId,null);assert.equal(getIssueAttachment(repo,actor,duplicate.attachmentId).url,sourceUrl);
  const before=Number((repo.db.prepare('SELECT count(*) AS count FROM issue_attachments').get() as any).count);
  assert.throws(()=>repo.transaction(()=>{repo.update(actor,'requests',first.id,{sourceUrl:'https://example.test/rollback'});throw new Error('Later batch operation failed');}),/batch operation/);assert.equal(repo.raw('requests',first.id)!.attachmentId,null);assert.equal(Number((repo.db.prepare('SELECT count(*) AS count FROM issue_attachments').get() as any).count),before);
 }finally{await f.app.close();}
});
test('existing request sources backfill once with stable attachment identity and a sync change',async()=>{
 const f=await fixture();try{const {repo,actor,issue}=f,request=repo.create(actor,'requests',{title:'Legacy request',issueId:issue.id});const old:RecordEntity={...request,sourceUrl:'https://example.test/legacy'};delete old.attachmentId;
  repo.db.prepare("UPDATE entities SET data=? WHERE kind='requests' AND id=?").run(JSON.stringify(old),request.id);
  repo.db.prepare('DELETE FROM data_migrations WHERE name=?').run('request-source-attachments-v2');
  initializeRequestSources(repo);const migrated=repo.raw('requests',request.id)!;assert.equal(migrated.version,request.version+1);assert.equal(migrated.updatedAt,request.updatedAt);assert.equal(getIssueAttachment(repo,actor,migrated.attachmentId).url,old.sourceUrl);
  const change=repo.db.prepare("SELECT data,actor_id FROM changes WHERE kind='requests' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(request.id) as any;assert.equal(change.actor_id,'system');assert.equal(JSON.parse(change.data).attachmentId,migrated.attachmentId);
  initializeRequestSources(repo);assert.equal(repo.raw('requests',request.id)!.version,migrated.version);assert.equal(repo.raw('requests',request.id)!.attachmentId,migrated.attachmentId);
 }finally{await f.app.close();}
});
test('project customer needs persist real source attachments through SDK creation and ordinary request edits',async()=>{
 const f=await fixture();try{const {repo,actor,sdk}=f,project=repo.create(actor,'projects',{name:'Project feedback'}),customer=repo.create(actor,'customers',{name:'Project customer',externalIds:['project-crm']});
  const created=await sdk.customerNeedCreate({projectId:project.id,customerExternalId:'project-crm',attachmentUrl:'https://example.test/project-feedback',body:'Project **requirements**',priority:1});const need=created.need;assert.ok(created.lastSyncId>0);assert.equal(need.projectId,project.id);assert.equal(need.issueId,null);assert.equal(need.attachment,null);assert.equal(need.attachmentId,null);assert.equal(need.customerId,customer.id);assert.ok(need.projectAttachment?.id);assert.deepEqual(need.projectAttachment.metadata,{});assert.equal(need.url,need.projectAttachment.url);
  const attachment=getProjectAttachment(repo,actor,need.projectAttachment.id);assert.equal(attachment.projectId,project.id);assert.equal(attachment.creatorId,actor.userId);
  const second=await sdk.customerNeedCreate({projectId:project.id,attachmentId:attachment.id});assert.equal(second.need.projectAttachment?.id,attachment.id);assert.equal(second.need.body,null);
  const ordinary=repo.create(actor,'requests',{title:'App source',projectId:project.id,sourceUrl:attachment.url,attachmentId:'forged',projectAttachmentId:'forged'});assert.equal(ordinary.attachmentId,null);assert.equal(ordinary.projectAttachmentId,attachment.id);
  const edited=repo.update(actor,'requests',ordinary.id,{sourceUrl:'https://example.test/changed-project-source'});assert.notEqual(edited.projectAttachmentId,attachment.id);assert.equal(getProjectAttachment(repo,actor,edited.projectAttachmentId).url,edited.sourceUrl);
  const restored=repo.update(actor,'requests',ordinary.id,{sourceUrl:attachment.url});assert.equal(restored.projectAttachmentId,attachment.id);const cleared=repo.update(actor,'requests',ordinary.id,{sourceUrl:null});assert.equal(cleared.projectAttachmentId,null);
 }finally{await f.app.close();}
});
test('need targets resolve issue identifiers and current projects while denying invalid or foreign references',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,project=repo.create(actor,'projects',{name:'Current project'});repo.update(actor,'issues',issue.id,{projectId:project.id});
  const created=await sdk.customerNeedCreate({issueId:issue.identifier,body:'Identifier input'});assert.equal(created.need.issueId,issue.id);assert.equal(created.need.projectId,project.id);
  const query='query($id:String!){customerNeed(id:$id){issue{id} project{id} creator{id} content}}';const read=await sdk.graphql<any>(query,{id:created.need.id});assert.equal(read.customerNeed.project.id,project.id);assert.equal(read.customerNeed.creator.id,actor.userId);assert.equal(read.customerNeed.content,'Identifier input');
  const otherProject=repo.create(actor,'projects',{name:'Moved issue project'});repo.update(actor,'issues',issue.id,{projectId:otherProject.id});assert.equal((await sdk.graphql<any>(query,{id:created.need.id})).customerNeed.project.id,otherProject.id);
  await assert.rejects(()=>sdk.customerNeedCreate({issueId:issue.id,projectId:project.id}),/exactly one/);await assert.rejects(()=>sdk.customerNeedCreate({}),/exactly one/);await assert.rejects(()=>sdk.customerNeedCreate({issueId:'MISSING-9'}),/not found/);
  const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign project workspace').workspaceId};const foreignProject=repo.create(foreign,'projects',{name:'Foreign'});await assert.rejects(()=>sdk.customerNeedCreate({projectId:foreignProject.id}),/not found/);
  assert.throws(()=>createCustomerNeed(repo,{...actor,scopes:['requests:write','projects:read']},{projectId:project.id}),/scope/);
 }finally{await f.app.close();}
});
test('project request source backfill is atomic, isolated and follows parent deletion and purge',async()=>{
 const f=await fixture();try{const {repo,actor}=f,project=repo.create(actor,'projects',{name:'Legacy project'}),request=repo.create(actor,'requests',{title:'Legacy source',projectId:project.id});
  repo.db.prepare("UPDATE entities SET data=json_set(data,'$.sourceUrl',?) WHERE kind='requests' AND id=?").run('https://example.test/legacy-project',request.id);repo.db.prepare('DELETE FROM data_migrations WHERE name=?').run('request-source-attachments-v2');initializeRequestSources(repo);
  const migrated=repo.raw('requests',request.id)!;assert.equal(migrated.version,request.version+1);assert.equal(migrated.attachmentId,null);assert.equal(getProjectAttachment(repo,actor,migrated.projectAttachmentId).projectId,project.id);initializeRequestSources(repo);assert.equal(repo.raw('requests',request.id)!.version,migrated.version);
  const count=()=>Number((repo.db.prepare('SELECT COUNT(*) AS count FROM project_attachments').get() as any).count);const before=count();assert.throws(()=>repo.transaction(()=>{repo.update(actor,'requests',request.id,{sourceUrl:'https://example.test/rolled-back-project-source'});throw new Error('Project source transaction failed');}),/transaction failed/);assert.equal(count(),before);
  const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Isolated sources').workspaceId};assert.throws(()=>getProjectAttachment(repo,foreign,migrated.projectAttachmentId),/not found/);
  repo.remove(actor,'projects',project.id);assert.throws(()=>getProjectAttachment(repo,actor,migrated.projectAttachmentId),/not found/);repo.restore(actor,'projects',project.id);assert.equal(getProjectAttachment(repo,actor,migrated.projectAttachmentId).projectId,project.id);repo.remove(actor,'projects',project.id);purgeExpiredTrash(repo,actor,new Date(Date.now()+32*86400000));assert.equal(count(),0);
 }finally{await f.app.close();}
});

test('customer need updates use SDK transport for body, reassignment, source replacement and clearing',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,customer=repo.create(actor,'customers',{name:'Reassigned',externalIds:['crm-update']});
 const original=(await sdk.customerNeedCreate({issueId:issue.id,body:'Original',attachmentUrl:'https://example.test/original'})).need;
 const shared=(await sdk.customerNeedCreate({issueId:issue.id,attachmentId:original.attachmentId!})).need;
 const changed=await sdk.customerNeedUpdate(original.id,{body:'Updated **Markdown**',customerExternalId:'crm-update',priority:1,attachmentUrl:'https://example.test/replacement'});
 assert.equal(changed.success,true);assert.ok(changed.lastSyncId>0);assert.equal(changed.need.body,'Updated **Markdown**');assert.equal(changed.need.customerId,customer.id);assert.equal(changed.need.priority,1);assert.notEqual(changed.need.attachmentId,original.attachmentId);assert.deepEqual(changed.updatedRelatedNeeds,[]);assert.equal(repo.get(actor,'requests',shared.id).attachmentId,original.attachmentId);
 const cleared=await sdk.customerNeedUpdate(original.id,{body:null,customerId:null},true);assert.equal(cleared.need.body,null);assert.equal(cleared.need.customerId,null);assert.equal(cleared.need.attachment,null);assert.equal(cleared.need.url,null);assert.equal(getIssueAttachment(repo,actor,shared.attachmentId!).url,'https://example.test/original');
 const version=repo.get(actor,'requests',original.id).version;
 for(const input of [{priority:2},{body:'x',customerId:customer.id,customerExternalId:'crm-update'},{attachmentUrl:'javascript:alert(1)'},{customerExternalId:'unknown'}])await assert.rejects(()=>sdk.customerNeedUpdate(original.id,input as any));
 await assert.rejects(()=>sdk.customerNeedUpdate(original.id,{attachmentUrl:'https://example.test/new'},true),/clear and replace/);assert.equal(repo.get(actor,'requests',original.id).version,version);
 }finally{await f.app.close();}
});
test('related need priority updates are scoped to the customer and direct target and roll back together',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,customer=repo.create(actor,'customers',{name:'Related'}),otherCustomer=repo.create(actor,'customers',{name:'Unrelated'}),project=repo.create(actor,'projects',{name:'Related project'});repo.update(actor,'issues',issue.id,{projectId:project.id});
 const make=(input:any)=>createCustomerNeed(repo,actor,input),a=make({issueId:issue.id,customerId:customer.id}),b=make({issueId:issue.id,customerId:customer.id}),unrelated=make({issueId:issue.id,customerId:otherCustomer.id}),p=make({projectId:project.id,customerId:customer.id}),p2=make({projectId:project.id,customerId:customer.id});
 const result=await sdk.customerNeedUpdate(a.id,{priority:1,applyPriorityToRelatedNeeds:true});assert.deepEqual(result.updatedRelatedNeeds.map(n=>n.id),[b.id]);assert.equal(repo.get(actor,'requests',unrelated.id).important,false);assert.equal(repo.get(actor,'requests',p.id).important,false);
 const projectResult=await sdk.customerNeedUpdate(p.id,{priority:1,applyPriorityToRelatedNeeds:true});assert.deepEqual(projectResult.updatedRelatedNeeds.map(n=>n.id),[p2.id]);
 const snapshot=repo.get(actor,'requests',a.id),originalUpdate=repo.update.bind(repo);repo.update=((...args:Parameters<typeof repo.update>)=>{if(args[2]===b.id)throw new Error('Simulated related write failure');return originalUpdate(...args);}) as typeof repo.update;
 assert.throws(()=>updateCustomerNeed(repo,actor,a.id,{priority:0,body:'Must roll back',attachmentUrl:'https://example.test/rollback',applyPriorityToRelatedNeeds:true}),/related write failure/);repo.update=originalUpdate;
 assert.deepEqual(repo.get(actor,'requests',a.id),snapshot);assert.equal(repo.db.prepare('SELECT id FROM issue_attachments WHERE url=?').get('https://example.test/rollback'),undefined);
 }finally{await f.app.close();}
});
test('need updates deny unauthorized and foreign access without writes and do not group unassociated customers',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,a=createCustomerNeed(repo,actor,{issueId:issue.id}),b=createCustomerNeed(repo,actor,{issueId:issue.id});
 const result=await sdk.customerNeedUpdate(a.id,{priority:1,applyPriorityToRelatedNeeds:true});assert.deepEqual(result.updatedRelatedNeeds,[]);assert.equal(repo.get(actor,'requests',b.id).important,false);
 const before=repo.get(actor,'requests',a.id);assert.throws(()=>updateCustomerNeed(repo,{...actor,scopes:['requests:read']},a.id,{body:'denied'}),/scope/);
 const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign needs').workspaceId};assert.throws(()=>updateCustomerNeed(repo,foreign,a.id,{body:'denied'}),/not found/);assert.deepEqual(repo.get(actor,'requests',a.id),before);
 }finally{await f.app.close();}
});

test('customer need archive and unarchive preserve identity, source and body through SDK transport',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f;
 const original=(await sdk.customerNeedCreate({issueId:issue.id,body:'Keep **context**',priority:1,attachmentUrl:'https://example.test/archive-source'})).need;
 const archived=await sdk.customerNeedArchive(original.id);assert.ok(archived.entity?.archivedAt);assert.equal(archived.entity?.attachmentId,original.attachmentId);assert.equal(archived.entity?.body,original.body);assert.equal(archived.entity?.priority,1);
 const version=repo.get(actor,'requests',original.id).version;const repeated=await sdk.customerNeedArchive(original.id);assert.equal(repeated.entity?.archivedAt,archived.entity?.archivedAt);assert.equal(repo.get(actor,'requests',original.id).version,version);
 const unarchived=await sdk.customerNeedUnarchive(original.id);assert.equal(unarchived.entity?.archivedAt,null);assert.equal(unarchived.entity?.id,original.id);assert.ok(unarchived.lastSyncId>archived.lastSyncId);
 await sdk.customerNeedDelete(original.id,true);const deletedArchive=await sdk.customerNeedArchive(original.id),deletedUnarchive=await sdk.customerNeedUnarchive(original.id);assert.equal(deletedArchive.entity,null);assert.equal(deletedUnarchive.entity,null);assert.ok(repo.raw('requests',original.id,true)?.deletedAt);
 }finally{await f.app.close();}
});
test('create need from attachment unarchives existing identity or creates from a retained issue source',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,customer=repo.create(actor,'customers',{name:'Source identity'});
 const original=(await sdk.customerNeedCreate({issueId:issue.id,customerId:customer.id,body:'Saved context',attachmentUrl:'https://example.test/revive-source'})).need;
 await sdk.customerNeedArchive(original.id);const revived=await sdk.customerNeedCreateFromAttachment({attachmentId:original.attachmentId!});assert.equal(revived.need.id,original.id);assert.equal(revived.need.archivedAt,null);assert.equal(revived.need.body,original.body);assert.equal(revived.need.customerId,customer.id);
 const version=repo.get(actor,'requests',original.id).version;const existing=await sdk.customerNeedCreateFromAttachment({attachmentId:original.attachmentId!});assert.equal(existing.need.id,original.id);assert.equal(repo.get(actor,'requests',original.id).version,version);
 await sdk.customerNeedDelete(original.id,true);const created=await sdk.customerNeedCreateFromAttachment({attachmentId:original.attachmentId!});assert.notEqual(created.need.id,original.id);assert.equal(created.need.attachmentId,original.attachmentId);assert.equal(created.need.issueId,issue.id);assert.equal(created.need.body,null);
 }finally{await f.app.close();}
});
test('customer need deletion retains requested or shared sources and removes unreferenced issue and project sources',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,project=repo.create(actor,'projects',{name:'Delete project request'});
 const original=(await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:'https://example.test/shared-delete'})).need,shared=(await sdk.customerNeedCreate({issueId:issue.id,attachmentId:original.attachmentId!})).need;await sdk.customerNeedArchive(shared.id);
 const deleted=await sdk.customerNeedDelete(original.id,false);assert.equal(deleted.entityId,original.id);assert.equal(deleted.success,true);assert.ok(deleted.lastSyncId>0);assert.equal(getIssueAttachment(repo,actor,original.attachmentId!).id,shared.attachmentId);
 await sdk.customerNeedDelete(shared.id,false);assert.throws(()=>getIssueAttachment(repo,actor,original.attachmentId!),/not found/);
 const kept=(await sdk.customerNeedCreate({projectId:project.id,attachmentUrl:'https://example.test/keep-project'})).need;await sdk.customerNeedDelete(kept.id,true);assert.equal(getProjectAttachment(repo,actor,kept.projectAttachment!.id).id,kept.projectAttachment!.id);
 const removed=(await sdk.customerNeedCreate({projectId:project.id,attachmentUrl:'https://example.test/delete-project'})).need;await sdk.customerNeedDelete(removed.id,false);assert.throws(()=>getProjectAttachment(repo,actor,removed.projectAttachment!.id),/not found/);
 await assert.rejects(()=>sdk.graphql('query($id:String!){customerNeed(id:$id){id}}',{id:removed.id}),/not found/);
 }finally{await f.app.close();}
});
test('need lifecycle authorization and transactional failures leave requests and source attachments unchanged',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,need=(await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:'https://example.test/atomic-delete'})).need;
 const {archiveCustomerNeed,deleteCustomerNeed,createCustomerNeedFromAttachment}=await import('../../src/server/customer-needs');
 const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign lifecycle').workspaceId},readonly={...actor,scopes:['requests:read','issues:read']};
 for(const denied of [foreign,readonly]){assert.throws(()=>archiveCustomerNeed(repo,denied,need.id,true));assert.throws(()=>deleteCustomerNeed(repo,denied,need.id,false));assert.throws(()=>createCustomerNeedFromAttachment(repo,denied,need.attachmentId!));}
 const snapshot=repo.get(actor,'requests',need.id),before=Number((repo.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq);
 repo.db.exec("CREATE TRIGGER fail_source_delete BEFORE DELETE ON issue_attachments BEGIN SELECT RAISE(ABORT,'simulated attachment failure'); END");
 await assert.rejects(()=>sdk.customerNeedDelete(need.id,false),/simulated attachment failure/);assert.deepEqual(repo.get(actor,'requests',need.id),snapshot);assert.equal(getIssueAttachment(repo,actor,need.attachmentId!).id,need.attachmentId);assert.equal(Number((repo.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq),before);repo.db.exec('DROP TRIGGER fail_source_delete');
 }finally{await f.app.close();}
});

test('customer need lifecycle GraphQL declarations match the pinned official schema',{skip:!existsSync(schemaFixture)},async()=>{
 const {readFile}=await import('node:fs/promises'),{buildSchema,isObjectType,isInputObjectType,isInterfaceType}=await import('graphql'),{buildApiSchema}=await import('../../src/server/graphql');
 const f=await fixture();try{const expected=buildSchema(await readFile(schemaFixture,'utf8')),actual=buildApiSchema(f.repo);
 const shape=(type:any)=>{assert.ok(isObjectType(type)||isInputObjectType(type)||isInterfaceType(type));return Object.fromEntries(Object.entries(type.getFields()).map(([name,field]:[string,any])=>[name,{type:String(field.type),args:field.args?Object.fromEntries(field.args.map((arg:any)=>[arg.name,String(arg.type)]).sort(([a]:[string],[b]:[string])=>a.localeCompare(b))):undefined}]));};
 for(const name of ['CustomerNeedArchivePayload','ArchivePayload','CustomerNeedCreateFromAttachmentInput','DeletePayload'])assert.deepEqual(shape(actual.getType(name)),shape(expected.getType(name)),name);
 const archive=actual.getType('CustomerNeedArchivePayload');assert.ok(isObjectType(archive));assert.deepEqual(archive.getInterfaces().map(i=>i.name),['ArchivePayload']);
 const nativeRoots=shape(expected.getMutationType()),localRoots=shape(actual.getMutationType());for(const name of ['customerNeedArchive','customerNeedUnarchive','customerNeedDelete','customerNeedCreateFromAttachment'])assert.deepEqual(localRoots[name],nativeRoots[name],name);
 }finally{await f.app.close();}
});

test('need moves preserve source identity across issue/project targets and track the original issue',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,other=repo.create(actor,'issues',{title:'Second issue',teamId:issue.teamId}),project=repo.create(actor,'projects',{name:'Moved request project'});
 const need=(await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:'https://example.test/moved-source',body:'Keep body',priority:1})).need;assert.equal(need.originalIssue,null);
 const moved=(await sdk.customerNeedUpdate(need.id,{issueId:other.identifier})).need;assert.equal(moved.attachmentId,need.attachmentId);assert.equal(moved.issueId,other.id);assert.equal(moved.originalIssue?.id,issue.id);assert.equal(getIssueAttachment(repo,actor,need.attachmentId!).issueId,other.id);
 const toProject=(await sdk.customerNeedUpdate(need.id,{projectId:project.id})).need;assert.equal(toProject.issueId,null);assert.equal(toProject.attachment,null);assert.equal(toProject.projectAttachment?.id,need.attachmentId);assert.equal(toProject.originalIssue?.id,issue.id);assert.equal(toProject.body,'Keep body');assert.equal(toProject.priority,1);assert.throws(()=>getIssueAttachment(repo,actor,need.attachmentId!),/not found/);
 repo.db.prepare('UPDATE project_attachments SET title=?,metadata=? WHERE id=?').run('Preserved source title',JSON.stringify({context:['source detail']}),need.attachmentId!);
 const back=(await sdk.customerNeedUpdate(need.id,{issueId:issue.id})).need;assert.equal(back.attachmentId,need.attachmentId);assert.equal(back.originalIssue?.id,issue.id);
 const again=(await sdk.customerNeedUpdate(need.id,{projectId:project.id})).need;assert.equal(again.projectAttachment?.title,'Preserved source title');assert.deepEqual(again.projectAttachment?.metadata,{context:['source detail']});assert.equal(again.projectAttachment?.id,need.attachmentId);
 const forged=repo.update(actor,'requests',need.id,{originalIssueId:other.id,requestOriginIssueId:other.id});assert.equal(forged.originalIssueId,issue.id);
 }finally{await f.app.close();}
});
test('moving shared sources copies only the selected request and target collisions reuse the existing source',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,other=repo.create(actor,'issues',{title:'Shared target',teamId:issue.teamId}),source='https://example.test/shared-move';
 const a=(await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:source})).need,b=(await sdk.customerNeedCreate({issueId:issue.id,attachmentId:a.attachmentId!})).need;await sdk.customerNeedArchive(b.id);
 const moved=(await sdk.customerNeedUpdate(a.id,{issueId:other.id})).need;assert.notEqual(moved.attachmentId,a.attachmentId);assert.equal(getIssueAttachment(repo,actor,a.attachmentId!).issueId,issue.id);assert.equal(repo.get(actor,'requests',b.id).attachmentId,a.attachmentId);
 const collision=(await sdk.customerNeedUpdate(b.id,{issueId:other.id})).need;assert.equal(collision.attachmentId,moved.attachmentId);assert.equal(getIssueAttachment(repo,actor,a.attachmentId!).issueId,issue.id);
 const project=repo.create(actor,'projects',{name:'Original project'}),projectNeed=(await sdk.customerNeedCreate({projectId:project.id})).need;await sdk.customerNeedUpdate(projectNeed.id,{issueId:issue.id});const movedAgain=(await sdk.customerNeedUpdate(projectNeed.id,{issueId:other.id})).need;assert.equal(movedAgain.originalIssue,null);
 }finally{await f.app.close();}
});
test('need move failures roll back attachment transfers and preserve source authorization',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,project=repo.create(actor,'projects',{name:'Atomic move'}),need=(await sdk.customerNeedCreate({issueId:issue.id,attachmentUrl:'https://example.test/atomic-move'})).need;
 const snapshot=repo.get(actor,'requests',need.id),before=Number((repo.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq);
 repo.db.exec("CREATE TRIGGER fail_request_move BEFORE UPDATE ON entities WHEN OLD.kind='requests' BEGIN SELECT RAISE(ABORT,'simulated move failure'); END");
 await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{projectId:project.id}),/simulated move failure/);repo.db.exec('DROP TRIGGER fail_request_move');assert.deepEqual(repo.get(actor,'requests',need.id),snapshot);assert.equal(getIssueAttachment(repo,actor,need.attachmentId!).issueId,issue.id);assert.equal(repo.db.prepare('SELECT id FROM project_attachments WHERE id=?').get(need.attachmentId!),undefined);assert.equal(Number((repo.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as any).seq),before);
 assert.throws(()=>updateCustomerNeed(repo,{...actor,scopes:['requests:write','requests:read','issues:read','projects:read']},need.id,{projectId:project.id}),/scope/);
 await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{issueId:null}),/exactly one/);await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{issueId:issue.id,projectId:project.id}),/exactly one/);
 const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign move').workspaceId},foreignProject=repo.create(foreign,'projects',{name:'Forbidden destination'});await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{projectId:foreignProject.id}),/not found/);assert.deepEqual(repo.get(actor,'requests',need.id),snapshot);
 }finally{await f.app.close();}
});

test('structured customer need bodies round-trip formatting through SDK reads and reflect later app edits',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f;
 const doc={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Customer context'}]},{type:'paragraph',content:[{type:'text',text:'Important',marks:[{type:'bold'}]},{type:'text',text:' feedback'}]},{type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[{type:'paragraph',content:[{type:'text',text:'Keep this task'}]}]}]},{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'paragraph',content:[{type:'text',text:'Cell content'}]}]}]}]}]};
 const need=(await sdk.customerNeedCreate({issueId:issue.id,bodyData:JSON.stringify(doc)})).need;assert.match(need.body!,/## Customer context/);assert.match(need.body!,/\*\*Important\*\*/);assert.match(need.body!,/Cell content/);const structured=JSON.parse(need.bodyData!);assert.deepEqual(structured.content.map((n:any)=>n.type),['heading','paragraph','taskList','table']);assert.equal(structured.content[2].content[0].attrs.checked,true);
 repo.update(actor,'requests',need.id,{body:'<p>Changed in <em>the app</em></p>'});const read=await sdk.graphql<any>('query($id:String!){customerNeed(id:$id){body bodyData}}',{id:need.id});assert.equal(read.customerNeed.body,'Changed in _the app_');assert.equal(JSON.parse(read.customerNeed.bodyData).content[0].content[1].marks[0].type,'italic');assert.doesNotMatch(read.customerNeed.bodyData,/Customer context/);
 const replacement={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'New structured body'}]}]};const updated=(await sdk.customerNeedUpdate(need.id,{bodyData:JSON.stringify(replacement)})).need;assert.equal(updated.body,'New structured body');const unchanged=(await sdk.customerNeedUpdate(need.id,{priority:1})).need;assert.equal(unchanged.bodyData,updated.bodyData);
 const cleared=(await sdk.customerNeedUpdate(need.id,{bodyData:null})).need;assert.equal(cleared.body,null);assert.equal(cleared.bodyData,null);
 }finally{await f.app.close();}
});
test('structured need inputs reject malformed or unsupported documents without partial request or attachment writes',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,need=(await sdk.customerNeedCreate({issueId:issue.id,body:'Keep original'})).need;
 const invalid=['{',JSON.stringify({type:'paragraph'}),JSON.stringify({type:'doc',content:[{type:'unknownNode'}]}),JSON.stringify({type:'doc',content:[{type:'paragraph',attrs:{unrecognized:'must not disappear'}}]}),JSON.stringify({type:'doc',content:[{type:'text',text:'Invalid top-level text'}]}),JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Unknown mark',marks:[{type:'unknownMark'}]}]}]}),' '.repeat(100001)];
 for(const bodyData of invalid){const before=repo.get(actor,'requests',need.id);await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{bodyData,attachmentUrl:'https://example.test/invalid-structured-source'}));assert.deepEqual(repo.get(actor,'requests',need.id),before);}
 await assert.rejects(()=>sdk.customerNeedCreate({issueId:issue.id,body:null,bodyData:null}),/not both/);await assert.rejects(()=>sdk.customerNeedUpdate(need.id,{body:'Markdown',bodyData:JSON.stringify({type:'doc',content:[]})}),/not both/);
 await assert.rejects(()=>sdk.customerNeedCreate({issueId:issue.id,bodyData:{type:'doc'} as any}),/JSON string/);assert.equal(repo.all('requests',actor.workspaceId).length,1);assert.equal(repo.db.prepare('SELECT COUNT(*) AS count FROM issue_attachments').get()?.count,0);
 }finally{await f.app.close();}
});
test('structured need bodies sanitize active URLs and preserve images and collapsible content',async()=>{
 const f=await fixture();try{const {issue,sdk}=f;
 const bodyData=JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Safe text',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},{type:'image',attrs:{src:'https://example.test/image.png',alt:'Diagram',width:200,height:100}},{type:'details',content:[{type:'detailsSummary',content:[{type:'text',text:'More context'}]},{type:'detailsContent',content:[{type:'paragraph',content:[{type:'text',text:'Hidden context'}]}]}]}]});
 const need=(await sdk.customerNeedCreate({issueId:issue.id,bodyData})).need;assert.doesNotMatch(need.bodyData!,/javascript:/);const doc=JSON.parse(need.bodyData!);assert.equal(doc.content[1].attrs.width,200);assert.equal(doc.content[1].attrs.height,100);assert.equal(doc.content[2].type,'details');assert.match(need.bodyData!,/Hidden context/);
 }finally{await f.app.close();}
});

test('customer need comment associations retain live context through moves and comment deletion or restoration',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,comment=repo.create(actor,'comments',{issueId:issue.id,body:'<p>Original context</p>'});
 const need=(await sdk.customerNeedCreate({issueId:issue.id,commentId:comment.id,body:'Manual need'})).need;assert.equal(need.comment?.id,comment.id);assert.equal(need.comment?.body,'<p>Original context</p>');
 repo.update(actor,'comments',comment.id,{body:'<p>Revised context</p>'});const project=repo.create(actor,'projects',{name:'Moved context'}),moved=(await sdk.customerNeedUpdate(need.id,{projectId:project.id})).need;assert.equal(moved.comment?.id,comment.id);assert.equal(moved.comment?.body,'<p>Revised context</p>');assert.equal(repo.get(actor,'comments',comment.id).issueId,issue.id);assert.equal(moved.body,'Manual need');
 repo.remove(actor,'comments',comment.id);assert.equal((await sdk.customerNeedUpdate(need.id,{priority:1})).need.comment,null);repo.restore(actor,'comments',comment.id);assert.equal((await sdk.customerNeedArchive(need.id)).entity?.comment?.id,comment.id);assert.equal((await sdk.customerNeedUnarchive(need.id)).entity?.comment?.id,comment.id);
 const empty=(await sdk.customerNeedCreate({projectId:project.id,commentId:null})).need;assert.equal(empty.comment,null);
 }finally{await f.app.close();}
});
test('customer need comment associations reject inaccessible references atomically and hide context after scope loss',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,comment=repo.create(actor,'comments',{issueId:issue.id,body:'<p>Private context</p>'}),restricted={...actor,scopes:['requests:write','issues:write']};
 const before=repo.all('requests',actor.workspaceId).length;assert.throws(()=>createCustomerNeed(repo,restricted,{issueId:issue.id,commentId:comment.id,attachmentUrl:'https://example.test/forbidden-comment'}));
 const foreign={...actor,workspaceId:f.app.auth.createWorkspace(actor.userId,'Foreign comments').workspaceId},team=repo.all('teams',foreign.workspaceId)[0],foreignIssue=repo.create(foreign,'issues',{title:'Foreign issue',teamId:team.id}),foreignComment=repo.create(foreign,'comments',{issueId:foreignIssue.id,body:'<p>Foreign comment</p>'});
 for(const commentId of ['',foreignComment.id,'missing-comment'])await assert.rejects(()=>sdk.customerNeedCreate({issueId:issue.id,commentId,attachmentUrl:'https://example.test/forbidden-comment'}));
 assert.equal(repo.all('requests',actor.workspaceId).length,before);assert.equal(repo.db.prepare('SELECT COUNT(*) AS count FROM issue_attachments').get()?.count,0);
 const need=(await sdk.customerNeedCreate({issueId:issue.id,commentId:comment.id})).need;
 const {requestComment}=await import('../../src/server/customer-needs');assert.equal(requestComment(repo,{...actor,scopes:['requests:read','issues:read']},repo.get(actor,'requests',need.id)),null);
 const old=repo.get(actor,'requests',need.id);assert.throws(()=>repo.update(actor,'requests',need.id,{commentId:foreignComment.id}));assert.deepEqual(repo.get(actor,'requests',need.id),old);
 }finally{await f.app.close();}
});

test('historical customer need creation dates preserve current activity and attachment clocks',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,before=Date.now();
 const need=(await sdk.customerNeedCreate({issueId:issue.id,createdAt:'2020-02-29T08:30:00+02:00',body:'Historical feedback',attachmentUrl:'https://example.test/historical-feedback'})).need;
 assert.equal(need.createdAt,'2020-02-29T06:30:00.000Z');assert.ok(Date.parse(need.updatedAt)>=before);assert.equal(repo.db.prepare("SELECT created_at FROM entities WHERE kind='requests' AND id=?").get(need.id)?.created_at,need.createdAt);
 const source=getIssueAttachment(repo,actor,need.attachmentId!);assert.ok(Date.parse(source.createdAt)>=before);const activities=repo.all('activities',actor.workspaceId).filter(row=>row.entityKind==='requests'&&row.entityId===need.id);assert.ok(activities.length>0);assert.ok(activities.every(row=>Date.parse(row.createdAt)>=before));
 const updated=(await sdk.customerNeedUpdate(need.id,{body:'Edited historical feedback'})).need;assert.equal(updated.createdAt,need.createdAt);assert.ok(Date.parse(updated.updatedAt)>=before);
 const regular=repo.create(actor,'requests',{issueId:issue.id,title:'Ordinary route',createdAt:'1900-01-01T00:00:00Z',updatedAt:'1900-01-01T00:00:00Z'});assert.ok(Date.parse(regular.createdAt)>=before);assert.ok(Date.parse(regular.updatedAt)>=before);
 const defaulted=(await sdk.customerNeedCreate({issueId:issue.id,createdAt:null})).need;assert.ok(Date.parse(defaulted.createdAt)>=before);
 }finally{await f.app.close();}
});
test('invalid historical need dates reject before requests sources and activities are created',async()=>{
 const f=await fixture();try{const {repo,actor,issue,sdk}=f,snapshot=()=>({requests:repo.all('requests',actor.workspaceId).length,activities:repo.all('activities',actor.workspaceId).length,sources:repo.db.prepare('SELECT COUNT(*) AS count FROM issue_attachments').get()?.count});const before=snapshot();
 for(const createdAt of ['not a date','2023-02-29T00:00:00Z','2020-02-30T00:00:00Z','2020-01-01T24:00:00Z','2020-01-01T00:00:00','2020-01-01T00:00:00+99:00','2999-01-01T00:00:00Z']){await assert.rejects(()=>sdk.customerNeedCreate({issueId:issue.id,createdAt,attachmentUrl:'https://example.test/invalid-date'}));assert.deepEqual(snapshot(),before);}
 assert.throws(()=>repo.create(actor,'issues',{title:'Invalid option',teamId:issue.teamId},{createdAt:new Date('2020-01-01T00:00:00Z')}));assert.deepEqual(snapshot(),before);
 }finally{await f.app.close();}
});

test('need creation resolves documented DateTime shortcuts from one clock',async()=>{
 const f=await fixture();try{const {repo,actor,issue}=f,clock={...actor,now:new Date('2026-03-31T12:34:56.000Z')};
 for(const [createdAt,expected] of [['2021','2021-01-01T00:00:00.000Z'],['2024-02','2024-02-01T00:00:00.000Z'],['2024-02-29','2024-02-29T00:00:00.000Z'],['-P2W1D','2026-03-16T12:34:56.000Z'],['-P1M','2026-02-28T12:34:56.000Z'],['-PT2H','2026-03-31T10:34:56.000Z']]){const need=createCustomerNeed(repo,clock,{issueId:issue.id,createdAt});assert.equal(need.createdAt,expected);assert.equal(need.updatedAt,clock.now.toISOString());}
 for(const createdAt of ['2023-02-29','2020-13','P1D','PT','-P99999999Y'])assert.throws(()=>createCustomerNeed(repo,clock,{issueId:issue.id,createdAt}));
 }finally{await f.app.close();}
});
