import type {Actor,RecordEntity,Repository} from './repository.ts';
import {assert} from './errors.ts';

export const OPEN_NOTIFICATION_LIMIT=2000;

/** Arrival is independent from edits/read state; wake reuses the existing event. */
export function validateNotificationArrival(actor:Actor,notification:RecordEntity,previous?:RecordEntity,provided:Record<string,any>=notification){
  if(!actor.system)for(const field of ['movedToInboxAt','unsnoozedAt'])if(Object.hasOwn(provided,field))assert((provided[field]??null)===(previous?.[field]??null),422,'Notification arrival is managed by the service','INVALID_NOTIFICATION_ARRIVAL');
  if(notification.snoozedUntil!=null){assert(typeof notification.snoozedUntil==='string'&&Number.isFinite(Date.parse(notification.snoozedUntil)),422,'Choose a valid snooze time','INVALID_NOTIFICATION_SNOOZE');notification.snoozedUntil=new Date(notification.snoozedUntil).toISOString();}
  if(notification.type==='reminder'&&!notification.deliveredAt){notification.snoozedUntil=notification.remindAt||notification.snoozedUntil;return;}
  if(notification.deletedAt||notification.archivedAt)return;
  const now=(actor.now||new Date()).toISOString(),manual=!!previous?.snoozedUntil&&notification.snoozedUntil==null,due=notification.snoozedUntil&&Date.parse(notification.snoozedUntil)<=Date.parse(now);
  if(!manual&&!due)return;
  const arrival=manual?now:notification.snoozedUntil;
  notification.unsnoozedAt=arrival;notification.movedToInboxAt=arrival;notification.snoozedUntil=null;
  // A read action on an expired legacy row should not be undone by materializing its wake.
  if(Object.hasOwn(provided,'snoozedUntil')||!Object.hasOwn(provided,'readAt'))notification.readAt=null;
}

export function runNotificationSnoozes(repo:Repository,actor:Actor,now:Date){
  const timestamp=now.toISOString(),system={...actor,system:true,now},rows=repo.db.prepare(`SELECT data FROM entities WHERE kind='notifications' AND workspace_id=? AND deleted_at IS NULL
    AND json_extract(data,'$.archivedAt') IS NULL AND json_extract(data,'$.snoozedUntil') IS NOT NULL AND json_extract(data,'$.snoozedUntil')<=?
    AND (json_extract(data,'$.type') IS NOT 'reminder' OR json_extract(data,'$.deliveredAt') IS NOT NULL)
    ORDER BY json_extract(data,'$.snoozedUntil'),id`).all(actor.workspaceId,timestamp) as {data:string}[];
  repo.transaction(()=>{for(const row of rows){const notification=repo.raw('notifications',JSON.parse(row.data).id);if(!notification||notification.archivedAt||!notification.snoozedUntil||!Number.isFinite(Date.parse(notification.snoozedUntil)))continue;const recipient=repo.actorForUser(notification.userId,notification.workspaceId);
    if(recipient.role==='none'||!repo.canRead(recipient,'notifications',notification)){repo.save('notifications',{...notification,deletedAt:timestamp,updatedAt:timestamp,version:notification.version+1},'delete',system);continue;}
    const arrived={...notification,updatedAt:timestamp,version:notification.version+1};validateNotificationArrival(system,arrived,notification,{snoozedUntil:notification.snoozedUntil});repo.save('notifications',arrived,'update',system);
  }});
}

export function issueStatusNotification(repo:Repository,issue:RecordEntity,previous?:RecordEntity){
  if(!previous)return false;
  if(issue.statusId!==previous.statusId&&['completed','canceled','duplicate'].includes(repo.raw('statuses',issue.statusId)?.type))return true;
  if(issue.priority!==previous.priority&&(issue.priority===1||previous.priority===1))return true;
  const dependencies=(entity:RecordEntity)=>JSON.stringify([...(entity.blockingIds||[])].sort())+JSON.stringify([...(entity.blockedByIds||[])].sort());
  return dependencies(issue)!==dependencies(previous);
}

export function retainOpenNotifications(repo:Repository,actor:Actor,notification:RecordEntity){
  if(notification.deletedAt||notification.archivedAt||!notification.userId)return;
  const now=(actor.now||new Date()).toISOString();
  if(notification.type==='reminder'&&!notification.deliveredAt||notification.snoozedUntil&&Date.parse(notification.snoozedUntil)>Date.parse(now))return;
  archiveOverflow(repo,actor,notification.workspaceId,notification.userId,now);
}

function archiveOverflow(repo:Repository,actor:Actor,workspaceId:string,userId:string,now:string){
  const overflow=repo.db.prepare(`SELECT data FROM entities WHERE kind='notifications' AND workspace_id=? AND deleted_at IS NULL
    AND json_extract(data,'$.userId')=? AND json_extract(data,'$.archivedAt') IS NULL
    AND (json_extract(data,'$.type') IS NOT 'reminder' OR json_extract(data,'$.deliveredAt') IS NOT NULL)
    AND (json_extract(data,'$.snoozedUntil') IS NULL OR json_extract(data,'$.snoozedUntil')<=?)
    ORDER BY coalesce(json_extract(data,'$.snoozedUntil'),json_extract(data,'$.movedToInboxAt'),json_extract(data,'$.unsnoozedAt'),json_extract(data,'$.deliveredAt'),created_at) DESC,id DESC LIMIT -1 OFFSET ?`).all(workspaceId,userId,now,OPEN_NOTIFICATION_LIMIT) as {data:string}[];
  for(const row of overflow){const old=JSON.parse(row.data);repo.save('notifications',{...old,archivedAt:now,updatedAt:now,version:old.version+1},'update',actor);}
}

export function runNotificationRetention(repo:Repository,actor:Actor,now:Date){
  const users=repo.db.prepare("SELECT DISTINCT json_extract(data,'$.userId') AS userId FROM entities WHERE kind='notifications' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.archivedAt') IS NULL").all(actor.workspaceId) as {userId:string}[];
  repo.transaction(()=>{for(const {userId}of users)if(userId)archiveOverflow(repo,actor,actor.workspaceId,userId,now.toISOString());});
}
