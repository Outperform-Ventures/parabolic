import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import type { Actor } from '../../src/server/repository.ts';

async function fixture(databasePath=':memory:') {
  const app=createApp({databasePath,port:0});
  const setup=await app.auth.setup({name:'Thread owner',email:'threads@example.test',password:'isolated-thread-test-password'});
  const repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2027-02-01T12:00:00Z')};
  const member=(role='member'):Actor=>{const id=randomUUID(),at=actor.now!.toISOString();repo.save('users',{id,workspaceId:actor.workspaceId,name:role,createdAt:at,updatedAt:at,version:1},'create',actor);repo.save('memberships',{id:randomUUID(),workspaceId:actor.workspaceId,userId:id,role,createdAt:at,updatedAt:at,version:1},'create',actor);return {...actor,userId:id,role,scopes:['read','write']};};
  const team=repo.all('teams',actor.workspaceId)[0],issue=()=>repo.create(actor,'issues',{teamId:team.id,title:randomUUID()});
  return {app,repo,actor,member,team,issue};
}
const code=(expected:string)=>(error:any)=>error.code===expected;

test('replies normalize to their same-target root across issue, document, project and update discussions',async()=>{
  const f=await fixture();try{const {repo,actor}=f,member=f.member();
    const project=repo.create(actor,'projects',{name:'Review'}),document=repo.create(actor,'documents',{title:'Document',projectId:project.id}),update=repo.create(actor,'updates',{projectId:project.id,body:'Update',health:'On track'});
    for(const fields of [{issueId:f.issue().id},{documentId:document.id},{projectId:project.id},{updateId:update.id,projectId:project.id}]){
      const root=repo.create(actor,'comments',{...fields,body:'Question'}),reply=repo.create(member,'comments',{...fields,parentId:root.id,body:'Answer'}),nested=repo.create(member,'comments',{parentId:reply.id,body:'Reply to answer'});
      assert.equal(nested.parentId,root.id);for(const [key,value] of Object.entries(fields))assert.equal(nested[key],value);
      const other=repo.create(actor,'comments',{...fields,body:'Different root'});
      assert.throws(()=>repo.update(member,'comments',reply.id,{parentId:other.id}),code('INVALID_COMMENT_THREAD'));
      assert.throws(()=>repo.update(actor,'comments',root.id,{parentId:reply.id}),code('INVALID_COMMENT_THREAD'));
      assert.throws(()=>repo.create(member,'comments',{...fields,parentId:root.id,body:'Reply anchor',anchor:{kind:'yjs',quote:'x'}}),code('INVALID_COMMENT_ANCHOR'));
    }
    const a=f.issue(),b=f.issue(),root=repo.create(actor,'comments',{issueId:a.id,body:'First issue'});
    assert.throws(()=>repo.create(member,'comments',{issueId:b.id,parentId:root.id,body:'Cross-issue reply'}),code('INVALID_COMMENT_THREAD'));
    assert.throws(()=>repo.create(member,'comments',{issueId:a.id,entityType:'issue',entityId:b.id,body:'Contradictory alias'}),code('INVALID_COMMENT_TARGET'));
    assert.throws(()=>repo.update(actor,'comments',root.id,{issueId:b.id}),code('INVALID_COMMENT_TARGET'));
    repo.remove(actor,'comments',root.id);assert.throws(()=>repo.create(member,'comments',{issueId:a.id,parentId:root.id,body:'Deleted parent'}),code('INVALID_COMMENT_THREAD'));
  }finally{await f.app.close();}
});

test('thread resolution owns root timestamps and chosen replies, preserves legacy input and clears deleted choices',async()=>{
  const f=await fixture();try{const {repo,actor}=f,member=f.member(),issue=f.issue(),root=repo.create(actor,'comments',{issueId:issue.id,body:'Question'}),reply=repo.create(member,'comments',{issueId:issue.id,parentId:root.id,body:'Decision'});
    const fixed=repo.update(member,'comments',root.id,{resolved:true,resolutionCommentId:reply.id,resolvedAt:'1990-01-01T00:00:00Z',resolvedById:actor.userId,version:root.version});
    assert.equal(fixed.resolved,true);assert.equal(fixed.resolvedAt,member.now!.toISOString());assert.equal(fixed.resolvedById,member.userId);assert.equal(fixed.resolutionCommentId,reply.id);assert.equal(repo.raw('comments',reply.id)!.resolved,false);
    assert.throws(()=>repo.update(member,'comments',root.id,{body:'Hijacked',resolved:false}),code('FORBIDDEN'));
    assert.throws(()=>repo.update(member,'comments',reply.id,{resolved:true}),code('THREAD_ROOT_REQUIRED'));
    for(const resolvedAt of ['not-a-date','1','2027-02-01','2027-02-01T12:00:00','2027-02-30T12:00:00Z','2027-02-01T24:00:00Z','2027-02-01T12:00:00+01:99'])assert.throws(()=>repo.update(member,'comments',root.id,{resolvedAt}),code('INVALID_THREAD_RESOLUTION'));
    assert.equal(repo.raw('comments',root.id)!.version,fixed.version,'Invalid timestamps cannot mutate the resolved thread');
    const other=repo.create(actor,'comments',{issueId:issue.id,body:'Other root'}),otherReply=repo.create(actor,'comments',{issueId:issue.id,parentId:other.id,body:'Unrelated answer'});
    assert.throws(()=>repo.update(member,'comments',root.id,{resolved:true,resolutionCommentId:otherReply.id}),code('INVALID_THREAD_RESOLUTION'));
    assert.throws(()=>repo.update(member,'comments',root.id,{resolved:true,resolutionCommentId:root.id}),code('INVALID_THREAD_RESOLUTION'));
    assert.throws(()=>repo.update(member,'comments',root.id,{resolved:false,version:1}),code('VERSION_CONFLICT'));
    const repeated=repo.update({...member,now:new Date('2027-02-02T12:00:00Z')},'comments',root.id,{resolved:true,resolutionCommentId:reply.id});assert.equal(repeated.resolvedAt,fixed.resolvedAt);
    repo.remove(member,'comments',reply.id);const afterDelete=repo.raw('comments',root.id)!;assert.equal(afterDelete.resolved,true);assert.equal(afterDelete.resolutionCommentId,null);assert.equal(afterDelete.resolvedAt,fixed.resolvedAt);
    repo.restore(member,'comments',reply.id);assert.equal(repo.raw('comments',root.id)!.resolutionCommentId,null);
    const reopened=repo.update(member,'comments',root.id,{resolved:false});assert.deepEqual([reopened.resolved,reopened.resolvedAt,reopened.resolvedById,reopened.resolutionCommentId],[false,null,null,null]);
    const legacy=repo.update(member,'comments',root.id,{resolvedAt:'1990-01-01T00:00:00Z'});assert.equal(legacy.resolved,true);assert.equal(legacy.resolvedAt,member.now!.toISOString());
    assert.equal(repo.update(member,'comments',root.id,{resolvedAt:null}).resolved,false);
    assert.equal(repo.update(member,'comments',root.id,{resolvedAt:'2024-02-29T12:30:45.123456+05:30'}).resolved,true,'Full ISO timestamps with offsets remain valid legacy intent');
    repo.save('comments',{...repo.raw('comments',root.id)!,resolved:true,resolvedAt:null,resolvedById:null},'update',actor);
    const body=repo.update(actor,'comments',root.id,{body:'Legacy resolved body edit'});assert.equal(body.resolved,true);assert.equal(body.resolvedAt,null,'An unrelated edit must not invent historical resolution metadata');
  }finally{await f.app.close();}
});

test('thread subscriptions and reply mentions notify only their thread without broad issue subscriptions',async()=>{
  const f=await fixture();try{const {repo,actor}=f,poster=f.member(),watcher=f.member(),mentioned=f.member(),issue=f.issue();
    const root=repo.create(poster,'comments',{issueId:issue.id,body:'Question'}),reply=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Answer'});
    const subscription=repo.create(watcher,'subscriptions',{entityKind:'comments',entityId:reply.id});assert.equal(subscription.entityId,root.id);
    assert.throws(()=>repo.create(watcher,'subscriptions',{entityKind:'comments',entityId:root.id,issueId:issue.id}),code('INVALID_THREAD_SUBSCRIPTION'));
    assert.throws(()=>repo.remove(poster,'subscriptions',subscription.id),code('NOT_FOUND'));
    const next=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Second answer'}),events=(id:string)=>repo.all('notifications',actor.workspaceId).filter(n=>n.userId===id);
    assert.ok(events(poster.userId).some(n=>n.entityId===next.id),'Posting joins the conversation so its author can receive replies');
    const notice=events(watcher.userId).find(n=>n.entityId===next.id)!;assert.equal(notice.parentCommentId,root.id);assert.equal(notice.commentId,next.id);
    const before=events(watcher.userId).length;repo.create(actor,'comments',{issueId:issue.id,body:'Unrelated thread'});repo.update(actor,'issues',issue.id,{priority:1});assert.equal(events(watcher.userId).length,before);
    repo.remove(watcher,'subscriptions',subscription.id);const unsubscribed=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'After unsubscribe'});assert.ok(!events(watcher.userId).some(n=>n.entityId===unsubscribed.id));
    const mention=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:`<p>Hello <span data-mention-kind="user" data-mention-id="${mentioned.userId}">@member</span></p>`});
    assert.ok(!repo.raw('issues',issue.id)!.subscriberIds.includes(mentioned.userId));
    assert.equal(repo.all('subscriptions',actor.workspaceId).filter(s=>s.userId===mentioned.userId&&s.entityKind==='comments'&&s.entityId===root.id).length,1);
    assert.ok(events(mentioned.userId).find(n=>n.entityId===mention.id)!.reasons.includes('mentioned'));
    const later=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Later answer'});assert.ok(events(mentioned.userId).some(n=>n.entityId===later.id));
    const topMention=f.member();repo.create(actor,'comments',{issueId:issue.id,body:'Top-level mention',mentionIds:[topMention.userId]});assert.ok(repo.raw('issues',issue.id)!.subscriberIds.includes(topMention.userId));
    const count=events(mentioned.userId).length;repo.update(actor,'teams',f.team.id,{private:true});repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Now private'});assert.equal(events(mentioned.userId).length,count);assert.equal(repo.list(mentioned,'subscriptions').nodes.length,0);
  }finally{await f.app.close();}
});

test('deleting a thread atomically hides its replies and restores only that deletion cohort with its resolution',async()=>{
  const f=await fixture();try{const {repo,actor}=f,author=f.member(),respondent=f.member();
    const project=repo.create(actor,'projects',{name:'Thread deletion'}),document=repo.create(actor,'documents',{title:'Inline thread'}),update=repo.create(actor,'updates',{projectId:project.id,body:'Update',health:'On track'});
    for(const fields of [{issueId:f.issue().id},{documentId:document.id},{projectId:project.id},{updateId:update.id,projectId:project.id}]){
      const root=repo.create(author,'comments',{...fields,body:'Question'}),reply=repo.create(respondent,'comments',{...fields,parentId:root.id,body:'Resolution'}),nested=repo.create(respondent,'comments',{...fields,parentId:root.id,body:'Older nested reply'}),removedEarlier=repo.create(respondent,'comments',{...fields,parentId:root.id,body:'Already withdrawn'});
      repo.save('comments',{...nested,parentId:reply.id},'update',actor);
      repo.remove(respondent,'comments',removedEarlier.id);
      const resolved=repo.update(respondent,'comments',root.id,{resolved:true,resolutionCommentId:reply.id});
      assert.throws(()=>repo.remove(author,'comments',reply.id),code('FORBIDDEN'),'Root authors cannot directly delete another author\'s reply');
      const deleted=repo.remove(author,'comments',root.id,resolved.version);
      for(const id of [root.id,reply.id,nested.id]){assert.equal(repo.raw('comments',id),null);assert.ok(repo.raw('comments',id,true)!.deletedAt);assert.throws(()=>repo.get(respondent,'comments',id),code('NOT_FOUND'));}
      assert.ok(!repo.list(respondent,'comments').nodes.some(c=>[root.id,reply.id,nested.id].includes(c.id)));
      assert.throws(()=>repo.restore(respondent,'comments',reply.id),code('INVALID_COMMENT_THREAD'),'A reply cannot be independently restored into a deleted root');
      const restored=repo.restore(author,'comments',root.id,deleted.version);
      assert.equal(restored.resolutionCommentId,reply.id);assert.equal(restored.resolved,true);assert.equal(restored.resolvedAt,resolved.resolvedAt);assert.equal(restored.resolvedById,respondent.userId);
      assert.equal(repo.raw('comments',reply.id)!.body,'Resolution');assert.equal(repo.raw('comments',reply.id)!.authorId,respondent.userId);assert.equal(repo.raw('comments',nested.id)!.parentId,root.id);
      assert.equal(repo.raw('comments',removedEarlier.id),null,'A reply deleted before the thread stays deleted');
      assert.equal(repo.update(respondent,'comments',reply.id,{body:'Restored and editable'}).body,'Restored and editable');
      assert.equal(repo.create(respondent,'comments',{parentId:root.id,body:'Continue restored conversation'}).parentId,root.id);
      assert.equal(repo.db.prepare('SELECT count(*) AS n FROM comment_deletion_cohorts WHERE root_id=?').get(root.id)!.n,0);
    }
  }finally{await f.app.close();}
});

test('thread deletion never expands across target or workspace boundaries and failure rolls back the entire cohort',async()=>{
  const f=await fixture();try{const {repo,actor}=f,member=f.member(),issue=f.issue(),root=repo.create(member,'comments',{issueId:issue.id,body:'Question'}),reply=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Valid reply'}),other=repo.create(actor,'comments',{issueId:f.issue().id,body:'Different target'});
    repo.save('comments',{...other,parentId:root.id},'update',actor);
    const foreign={...other,id:randomUUID(),workspaceId:randomUUID(),parentId:root.id};repo.save('comments',foreign,'create',actor);
    const deleted=repo.remove(member,'comments',root.id);
    assert.ok(repo.raw('comments',other.id));assert.ok(repo.raw('comments',foreign.id));assert.equal(repo.raw('comments',reply.id),null);
    // A target removed while the thread is in trash must not produce a partially restored graph.
    repo.remove(actor,'issues',issue.id);
    assert.throws(()=>repo.restore(member,'comments',root.id),code('INVALID_COMMENT_TARGET'));
    assert.equal(repo.raw('comments',root.id),null);assert.equal(repo.raw('comments',reply.id),null);
    assert.equal(repo.raw('comments',root.id,true)!.version,deleted.version);
    repo.restore(actor,'issues',issue.id);assert.ok(repo.restore(member,'comments',root.id));assert.ok(repo.raw('comments',reply.id));
  }finally{await f.app.close();}
});

test('API batch deletion and Undo restore a comment cohort once while preserving earlier deleted replies',async()=>{
  const f=await fixture();try{const {repo}=f,author=f.member(),respondent=f.member(),issue=f.issue(),root=repo.create(author,'comments',{issueId:issue.id,body:'Question'}),reply=repo.create(respondent,'comments',{issueId:issue.id,parentId:root.id,body:'Resolution'}),old=repo.create(respondent,'comments',{issueId:issue.id,parentId:root.id,body:'Withdrawn'});
    repo.remove(respondent,'comments',old.id);const resolved=repo.update(respondent,'comments',root.id,{resolved:true,resolutionCommentId:reply.id});
    const token=f.app.auth.issueToken(author,{name:'Delete thread',scopes:['comments:write']}),{url}=await f.app.start();
    const batch=async(body:any)=>{const response=await fetch(url+'/api/v1/batch',{method:'POST',headers:{authorization:`Bearer ${token.token}`,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
    const deletion={clientMutationId:randomUUID(),operations:[{kind:'comments',action:'delete',id:root.id,data:{version:resolved.version}}]};
    await batch(deletion);const rootVersion=repo.raw('comments',root.id,true)!.version,replyVersion=repo.raw('comments',reply.id,true)!.version;await batch(deletion);assert.equal(repo.raw('comments',reply.id,true)!.version,replyVersion);
    const undo={clientMutationId:randomUUID(),operations:[{kind:'comments',action:'restore',id:root.id,data:{version:rootVersion}}]};await batch(undo);await batch(undo);
    assert.equal(repo.raw('comments',reply.id)!.version,replyVersion+1);assert.equal(repo.raw('comments',root.id)!.resolutionCommentId,reply.id);assert.equal(repo.raw('comments',old.id),null);
  }finally{await f.app.close();}
});

test('comment deletion cohorts survive SQLite restart without losing reply authors or resolution selection',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'parabolic-comment-cohort-')),databasePath=join(directory,'workspace.sqlite'),f=await fixture(databasePath);let reopened:ReturnType<typeof createApp>|undefined;
  try{const {repo,actor}=f,member=f.member(),issue=f.issue(),root=repo.create(member,'comments',{issueId:issue.id,body:'Durable question'}),reply=repo.create(actor,'comments',{issueId:issue.id,parentId:root.id,body:'Durable resolution'});
    const resolved=repo.update(member,'comments',root.id,{resolved:true,resolutionCommentId:reply.id});repo.remove(member,'comments',root.id);await f.app.close();
    reopened=createApp({databasePath,port:0});assert.equal(reopened.repo.raw('comments',reply.id),null);
    const restored=reopened.repo.restore(member,'comments',root.id);assert.equal(restored.resolutionCommentId,reply.id);assert.equal(restored.resolvedAt,resolved.resolvedAt);assert.equal(reopened.repo.raw('comments',reply.id)!.authorId,actor.userId);assert.equal(reopened.repo.raw('comments',reply.id)!.body,'Durable resolution');
  }finally{await f.app.close();await reopened?.close();await rm(directory,{recursive:true,force:true});}
});

test('resolution scope permits shared guests but preserves body ownership and parent privacy for every discussion target',async()=>{
  const f=await fixture();try{const {repo,actor}=f,member=f.member(),guest=f.member('guest'),privateTeam=repo.create(actor,'teams',{name:'Shared',key:'SHR',visibility:'private',issueSharingEnabled:true}),issue=repo.create(actor,'issues',{teamId:privateTeam.id,title:'Shared issue',sharedWithIds:[guest.userId]}),root=repo.create(actor,'comments',{issueId:issue.id,body:'Discussion'});
    assert.equal(repo.update(guest,'comments',root.id,{resolved:true}).resolvedById,guest.userId);
    assert.throws(()=>repo.update(guest,'comments',root.id,{resolved:false,body:'Overwritten'}),code('FORBIDDEN'));
    assert.throws(()=>repo.update(member,'comments',root.id,{resolved:false}),code('NOT_FOUND'));
    assert.throws(()=>repo.update({...guest,scopes:['read']},'comments',root.id,{resolved:false}),code('FORBIDDEN'));
    const project=repo.create(actor,'projects',{name:'Public review'}),document=repo.create(actor,'documents',{title:'Review'}),update=repo.create(actor,'updates',{projectId:project.id,body:'Status',health:'On track'});
    for(const fields of [{projectId:project.id},{documentId:document.id},{updateId:update.id,projectId:project.id}]){
      const comment=repo.create(actor,'comments',{...fields,body:'Root'}),scoped={...member,scopes:['comments:write']};
      const changed=repo.update(scoped,'comments',comment.id,{resolved:true});assert.equal(changed.resolved,true);assert.equal(changed.resolvedById,member.userId);assert.equal(repo.update(scoped,'comments',comment.id,{resolved:false}).resolvedAt,null);
    }
  }finally{await f.app.close();}
});

test('REST, batch replay and GraphQL share atomic resolution validation and server-owned metadata',async()=>{
  const f=await fixture();try{const {repo,actor}=f,member=f.member(),issue=f.issue(),root=repo.create(actor,'comments',{issueId:issue.id,body:'Question'}),reply=repo.create(member,'comments',{issueId:issue.id,parentId:root.id,body:'Answer'}),other=repo.create(actor,'comments',{issueId:issue.id,body:'Other'}),foreign=repo.create(actor,'comments',{issueId:issue.id,parentId:other.id,body:'Other answer'});
    const token=f.app.auth.issueToken(member,{name:'Thread client',scopes:['comments:write']}),{url}=await f.app.start(),headers={authorization:`Bearer ${token.token}`,'content-type':'application/json'};
    const call=async(path:string,data:any,method='POST')=>{const response=await fetch(url+path,{method,headers,body:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
    const batch={clientMutationId:randomUUID(),operations:[{kind:'comments',action:'update',id:root.id,data:{resolved:true,resolutionCommentId:reply.id,version:root.version}}]};
    const first=await call('/api/v1/batch',batch);assert.equal(first.status,200);const before=repo.raw('comments',root.id)!.version;assert.equal((await call('/api/v1/batch',batch)).status,200);assert.equal(repo.raw('comments',root.id)!.version,before);
    const invalid=await call('/api/v1/batch',{operations:[{kind:'comments',action:'update',id:root.id,data:{resolved:false}},{kind:'comments',action:'update',id:other.id,data:{resolved:true,resolutionCommentId:reply.id}}]});assert.equal(invalid.status,422);assert.equal(repo.raw('comments',root.id)!.resolved,true,'Invalid later operation rolls back the first reopen');
    const response=await call('/graphql',{query:'mutation($id:String!){commentUpdate(id:$id,input:{resolved:false}){success comment{id resolved resolvedAt resolvedById resolutionCommentId}}}',variables:{id:root.id}});assert.equal(response.data.errors,undefined);assert.equal(response.data.data.commentUpdate.comment.resolved,false);assert.equal(response.data.data.commentUpdate.comment.resolvedAt,null);
    const rejected=await call(`/api/v1/comments/${root.id}`,{resolved:true,resolutionCommentId:foreign.id},'PATCH');assert.equal(rejected.status,422);assert.equal(repo.raw('comments',root.id)!.resolved,false);
    const denied=await call(`/api/v1/comments/${root.id}`,{resolved:true,body:'Unauthorized edit'},'PATCH');assert.equal(denied.status,403);
  }finally{await f.app.close();}
});
