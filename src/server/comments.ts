import {guestOperationalAccess} from './guest-access';
import { randomUUID } from 'node:crypto';
import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';

const targetFields = ['issueId','documentId','projectId','initiativeId','updateId'] as const;
const targetKinds = { issueId:'issues',documentId:'documents',projectId:'projects',initiativeId:'initiatives',updateId:'updates' } as const;
const resolutionFields = ['resolved','resolvedAt','resolvedById','resolutionCommentId'];
const readActor = (actor: Actor) => ({...actor,scopes:[...actor.scopes,'read']});
const resolved = (comment?: RecordEntity) => !!comment && (typeof comment.resolved === 'boolean' ? comment.resolved : !!comment.resolvedAt);

export function isIsoTimestamp(value: unknown) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [,year,month,day,hour,minute,second,zone] = match;
  const leap = Number(year)%4 === 0 && (Number(year)%100 !== 0 || Number(year)%400 === 0);
  const days = [31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return Number(month)>=1 && Number(month)<=12 && Number(day)>=1 && Number(day)<=days[Number(month)-1] && Number(hour)<24 && Number(minute)<60 && Number(second)<60 && (zone==='Z' || Number(zone.slice(1,3))<24 && Number(zone.slice(4))<60);
}

function target(repo: Repository, actor: Actor, comment: RecordEntity, required = true) {
  const field = comment.updateId ? 'updateId' : comment.issueId ? 'issueId' : comment.documentId ? 'documentId' : comment.projectId ? 'projectId' : comment.initiativeId ? 'initiativeId' : null;
  if (!field) { assert(!required,422,'A comment must belong to an accessible issue, document, project, initiative or update','INVALID_COMMENT_TARGET'); return null; }
  const parent = field === 'updateId' ? repo.get(readActor(actor),'updates',comment[field]) : repo.raw(targetKinds[field],comment[field]);
  assert(parent && repo.canRead(readActor(actor),targetKinds[field],parent),422,'Comment target is not accessible','INVALID_COMMENT_TARGET');
  for (const other of targetFields) {
    if (other === field || !comment[other]) continue;
    assert(['projectId','initiativeId'].includes(other) && comment[other] === parent[other],422,'Comment target fields belong to different entities','INVALID_COMMENT_TARGET');
  }
  if (comment.entityType || comment.entityId) {
    const aliases: Record<string,string> = {issue:'issueId',document:'documentId',project:'projectId',initiative:'initiativeId',update:'updateId'};
    assert(aliases[comment.entityType] === field && comment.entityId === comment[field],422,'Comment target aliases disagree','INVALID_COMMENT_TARGET');
  }
  return `${field}:${comment[field]}`;
}

/** Resolve old nested replies without trusting a client-supplied root ID. */
export function commentRoot(repo: Repository, actor: Actor, comment: RecordEntity) {
  let root = comment;
  const seen = new Set<string>();
  while (root.parentId) {
    assert(typeof root.parentId === 'string' && !seen.has(root.id),422,'Comment thread contains a cycle','INVALID_COMMENT_THREAD');
    seen.add(root.id);
    const parent = repo.raw('comments',root.parentId);
    assert(parent && repo.canRead(readActor(actor),'comments',parent),422,'Comment thread root is not accessible','INVALID_COMMENT_THREAD');
    assert(target(repo,actor,root,false) === null || target(repo,actor,root) === target(repo,actor,parent),422,'Comment parent belongs to another target','INVALID_COMMENT_THREAD');
    root = parent;
  }
  assert(!seen.has(root.id),422,'Comment thread contains a cycle','INVALID_COMMENT_THREAD');
  return root;
}

export function resolutionOnly(patch: Record<string,unknown>) {
  return Object.keys(patch).some(key => resolutionFields.includes(key)) && Object.keys(patch).every(key => key === 'version' || resolutionFields.includes(key));
}

export function validateComment(repo: Repository, actor: Actor, comment: RecordEntity, previous?: RecordEntity, provided: Record<string,any> = comment) {
  assert(actor.role !== 'guest' || comment.issueId || comment.parentId || guestOperationalAccess(repo,actor,'comments',comment),403,'Guests can comment only on issues shared with them','FORBIDDEN');
  const aliasFields: Record<string,string> = {issue:'issueId',document:'documentId',project:'projectId',initiative:'initiativeId',update:'updateId'};
  const alias = aliasFields[provided.entityType];
  if (alias && provided.entityId && provided[alias]) assert(provided[alias] === provided.entityId,422,'Comment target aliases disagree','INVALID_COMMENT_TARGET');
  if (comment.parentId) {
    const parent = repo.raw('comments',comment.parentId);
    assert(parent && repo.canRead(readActor(actor),'comments',parent),422,'Comment parent is not accessible','INVALID_COMMENT_THREAD');
    const root = commentRoot(repo,actor,parent);
    assert(root.id !== comment.id,422,'A comment cannot reply to itself','INVALID_COMMENT_THREAD');
    if (!targetFields.some(field => comment[field])) for (const field of targetFields) if (root[field]) comment[field] = root[field];
    assert(target(repo,actor,comment) === target(repo,actor,root),422,'Comment parent belongs to another target','INVALID_COMMENT_THREAD');
    comment.parentId = root.id;
    assert(!comment.anchor,422,'Only a root comment can own an inline anchor','INVALID_COMMENT_ANCHOR');
  }
  const destination = target(repo,actor,comment);
  if (previous) {
    assert(destination === target(repo,actor,previous),422,'A comment cannot be moved to another target','INVALID_COMMENT_TARGET');
    const oldRoot = commentRoot(repo,actor,previous);
    assert((comment.parentId || comment.id) === oldRoot.id,422,'A comment cannot be moved to another thread','INVALID_COMMENT_THREAD');
  }
  const hasIntent = Object.hasOwn(provided,'resolved') || Object.hasOwn(provided,'resolvedAt') || Object.hasOwn(provided,'resolutionCommentId');
  if (Object.hasOwn(provided,'resolved')) assert(typeof provided.resolved === 'boolean',422,'Resolved must be a boolean','INVALID_THREAD_RESOLUTION');
  if (Object.hasOwn(provided,'resolvedAt')) assert(provided.resolvedAt == null || isIsoTimestamp(provided.resolvedAt),422,'Resolved timestamp must be an ISO timestamp with a time zone or null','INVALID_THREAD_RESOLUTION');
  if (comment.parentId) {
    assert(!hasIntent || (!provided.resolved && !provided.resolvedAt && !provided.resolutionCommentId),422,'Resolve the root comment and select this reply as its resolution','THREAD_ROOT_REQUIRED');
    comment.resolved = false; comment.resolvedAt = null; comment.resolvedById = null; comment.resolutionCommentId = null;
    return;
  }
  const next = Object.hasOwn(provided,'resolved') ? provided.resolved : Object.hasOwn(provided,'resolvedAt') ? provided.resolvedAt != null : resolved(previous);
  assert(next || provided.resolutionCommentId == null,422,'A reopened thread cannot select a resolution reply','INVALID_THREAD_RESOLUTION');
  const choice = next ? Object.hasOwn(provided,'resolutionCommentId') ? provided.resolutionCommentId : previous?.resolutionCommentId ?? null : null;
  if (choice != null) {
    assert(typeof choice === 'string' && next,422,'Select a resolution reply only for a resolved thread','INVALID_THREAD_RESOLUTION');
    const reply = repo.raw('comments',choice);
    assert(reply && reply.id !== comment.id && reply.parentId && repo.canRead(readActor(actor),'comments',reply) && commentRoot(repo,actor,reply).id === comment.id,422,'Resolution reply must be active and belong to this thread','INVALID_THREAD_RESOLUTION');
  }
  comment.resolved = !!next;
  if (!next) { comment.resolvedAt = null; comment.resolvedById = null; comment.resolutionCommentId = null; return; }
  const changed = !resolved(previous) || choice !== (previous?.resolutionCommentId ?? null);
  // Existing legacy resolution metadata is preserved during unrelated body edits.
  comment.resolvedAt = changed && hasIntent ? (actor.now || new Date()).toISOString() : previous?.resolvedAt ?? null;
  comment.resolvedById = changed && hasIntent ? actor.userId : previous?.resolvedById ?? null;
  comment.resolutionCommentId = choice;
}

export function validateThreadSubscription(repo: Repository, actor: Actor, entity: RecordEntity, previous?: RecordEntity) {
  if (previous?.entityKind === 'comments') assert(entity.entityKind === 'comments',422,'A thread subscription cannot change target type','INVALID_THREAD_SUBSCRIPTION');
  if (entity.entityKind !== 'comments') return;
  assert(typeof entity.entityId === 'string' && !targetFields.some(field => entity[field]),422,'Thread subscriptions must target only a root comment','INVALID_THREAD_SUBSCRIPTION');
  const comment = repo.raw('comments',entity.entityId);
  assert(comment && repo.canRead(readActor(actor),'comments',comment),422,'Subscription thread is not accessible','INVALID_THREAD_SUBSCRIPTION');
  entity.entityId = commentRoot(repo,actor,comment).id;
  if (previous) assert(entity.entityId === commentRoot(repo,actor,repo.raw('comments',previous.entityId)!).id,422,'A thread subscription cannot be moved','INVALID_THREAD_SUBSCRIPTION');
}

export function subscribeCommentParticipants(repo: Repository, actor: Actor, comment: RecordEntity, previous?: RecordEntity) {
  const root = commentRoot(repo,actor,comment), ids = new Set<string>(!previous ? [actor.userId] : []);
  if (comment.parentId) for (const id of comment.mentionIds || []) if (!previous?.mentionIds?.includes(id)) ids.add(id);
  for (const userId of ids) {
    const recipient = repo.actorForUser(userId,actor.workspaceId);
    if (recipient.role === 'none' || !repo.canRead(recipient,'comments',comment)) continue;
    const exists = repo.db.prepare("SELECT id FROM entities WHERE kind='subscriptions' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.userId')=? AND json_extract(data,'$.entityKind')='comments' AND json_extract(data,'$.entityId')=? LIMIT 1").get(actor.workspaceId,userId,root.id);
    if (exists) continue;
    const at = (actor.now || new Date()).toISOString();
    repo.save('subscriptions',{id:randomUUID(),workspaceId:actor.workspaceId,userId,creatorId:userId,entityKind:'comments',entityId:root.id,createdAt:at,updatedAt:at,version:1},'create',actor);
  }
}

export function threadRecipients(repo: Repository, actor: Actor, comment: RecordEntity, previous: RecordEntity | undefined, add: (id:string,reason:string)=>void) {
  if (previous || !comment.parentId) return;
  const root = commentRoot(repo,actor,comment);
  for (const row of repo.db.prepare("SELECT data FROM entities WHERE kind='subscriptions' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.entityKind')='comments' AND json_extract(data,'$.entityId')=?").all(actor.workspaceId,root.id) as {data:string}[]) add(JSON.parse(row.data).userId,'comments');
}

export function removeResolutionReply(repo: Repository, actor: Actor, removed: RecordEntity) {
  for (const row of repo.db.prepare("SELECT data FROM entities WHERE kind='comments' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.resolutionCommentId')=?").all(actor.workspaceId,removed.id) as {data:string}[]) {
    const root = JSON.parse(row.data) as RecordEntity;
    const changed = {...root,resolutionCommentId:null,version:root.version+1,updatedAt:(actor.now || new Date()).toISOString()};
    repo.save('comments',changed,'update',actor); repo.activity(actor,'comments',changed,'update',root);
  }
}

/** Native ordinary comment deletion removes replies; our soft deletion retains their data for Undo. */
export function removeCommentReplies(repo: Repository, actor: Actor, removed: RecordEntity) {
  const destination = target(repo,actor,removed), queue = [removed.id], seen = new Set(queue);
  const children = repo.db.prepare("SELECT data FROM entities WHERE kind='comments' AND workspace_id=? AND json_extract(data,'$.parentId')=? AND deleted_at IS NULL");
  for (let index=0; index<queue.length; index++) {
    for (const row of children.all(actor.workspaceId,queue[index]) as {data:string}[]) {
      const child = JSON.parse(row.data) as RecordEntity;
      if (seen.has(child.id) || !repo.canRead(readActor(actor),'comments',child)) continue;
      // Corrupt legacy cross-target references must never turn into authorization to delete that target.
      let sameTarget = false;
      try { sameTarget = target(repo,actor,child) === destination; } catch { /* Leave unrelated malformed data intact. */ }
      if (!sameTarget) continue;
      seen.add(child.id); queue.push(child.id);
      const deleted = {...child,deletedAt:removed.deletedAt,updatedAt:removed.updatedAt,version:child.version+1};
      repo.db.prepare('INSERT INTO comment_deletion_cohorts VALUES(?,?,?,?,?)').run(actor.workspaceId,removed.id,removed.version,child.id,deleted.version);
      repo.save('comments',deleted,'delete',actor); repo.activity(actor,'comments',deleted,'delete');
    }
  }
}

/** Caller holds the transaction and has authorized restoring the requested comment. */
export function restoreCommentThread(repo: Repository, actor: Actor, previous: RecordEntity): RecordEntity {
  const at = (actor.now || new Date()).toISOString(), originals = [previous];
  const cohort = repo.db.prepare('SELECT comment_id,deleted_version FROM comment_deletion_cohorts WHERE workspace_id=? AND root_id=? AND root_version=?').all(actor.workspaceId,previous.id,previous.version) as {comment_id:string;deleted_version:number}[];
  for (const item of cohort) {
    const child = repo.raw('comments',item.comment_id,true);
    if (child?.deletedAt && child.version===item.deleted_version && repo.canRead(readActor(actor),'comments',child)) originals.push(child);
  }
  const restored: RecordEntity[] = originals.map(comment => ({...comment,deletedAt:null,updatedAt:at,version:comment.version+1}));
  // Make the whole restoration graph visible to validation inside the transaction.
  // No change events are published until every member validates and the transaction commits.
  // This also lets a resolved root validate its selected reply regardless of save order.
  for (const comment of restored) repo.db.prepare("UPDATE entities SET data=?,deleted_at=NULL WHERE kind='comments' AND id=?").run(JSON.stringify(comment),comment.id);
  for (let index=0; index<restored.length; index++) {
    const comment = restored[index], original = originals[index];
    if (comment.resolutionCommentId && !repo.raw('comments',comment.resolutionCommentId)) {
      comment.resolutionCommentId = null;
      // An independently removed resolution is not a new resolution by the restoring user.
      repo.validate(actor,'comments',comment,{...original,resolutionCommentId:null},{});
    } else repo.validate(actor,'comments',comment,original,{});
  }
  for (const comment of restored) { repo.save('comments',comment,'restore',actor); repo.activity(actor,'comments',comment,'restore'); }
  repo.db.prepare('DELETE FROM comment_deletion_cohorts WHERE workspace_id=? AND root_id=? AND root_version=?').run(actor.workspaceId,previous.id,previous.version);
  return restored[0];
}
