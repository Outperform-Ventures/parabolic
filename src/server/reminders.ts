import {assert} from './errors.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';
export const REMINDER_KINDS=['issues','documents','projects','initiatives'] as const;
const fields={issues:'issueId',documents:'documentId',projects:'projectId',initiatives:'initiativeId'} as const;
export function validateReminder(repo:Repository,actor:Actor,notification:RecordEntity,previous?:RecordEntity){
 if(notification.type!=='reminder'){assert(previous?.type!=='reminder',422,'Reminder type cannot be changed','INVALID_REMINDER');return;}
 assert(!previous||previous.type==='reminder',422,'Create a separate reminder for this record','INVALID_REMINDER');
 assert(actor.system||notification.userId===actor.userId,403,'Reminders belong to the current user','FORBIDDEN');
 const kind=notification.entityKind||REMINDER_KINDS.find(kind=>notification[fields[kind]]),id=notification.entityId||(kind&&notification[fields[kind as keyof typeof fields]]);
 assert(REMINDER_KINDS.includes(kind)&&typeof id==='string',422,'Choose an issue, document, project or initiative','INVALID_REMINDER');
 assert(!previous||((previous.entityKind||kind)===kind&&(previous.entityId||id)===id),422,'A reminder cannot be moved to another record','INVALID_REMINDER');
 const parent=repo.get(actor,kind,id);notification.entityKind=kind;notification.entityId=id;for(const field of Object.values(fields))delete notification[field];notification[fields[kind as keyof typeof fields]]=id;
 notification.title=parent.title||parent.name;notification.remindAt??=notification.snoozedUntil;
 assert(typeof notification.remindAt==='string'&&Number.isFinite(Date.parse(notification.remindAt)),422,'Choose a valid reminder time','INVALID_REMINDER');
 const changed=!previous||notification.remindAt!==(previous.remindAt||previous.snoozedUntil);
 if(changed){assert(Date.parse(notification.remindAt)>(actor.now||new Date()).getTime(),422,'Choose a time in the future','REMINDER_IN_PAST');notification.remindAt=new Date(notification.remindAt).toISOString();notification.deliveredAt=null;notification.snoozedUntil=notification.remindAt;notification.readAt=null;notification.archivedAt=null;}
 else if(!actor.system)assert(notification.deliveredAt===previous?.deliveredAt,422,'Reminder delivery is managed by the service','INVALID_REMINDER');
}
export function runReminders(repo:Repository,actor:Actor,now:Date){
 for(const reminder of repo.all('notifications',actor.workspaceId)){
  if(reminder.type!=='reminder'||reminder.deliveredAt)continue;const at=reminder.remindAt||reminder.snoozedUntil;if(!at||!Number.isFinite(Date.parse(at))||Date.parse(at)>now.getTime())continue;
  const kind=reminder.entityKind||REMINDER_KINDS.find(kind=>reminder[fields[kind]]),id=reminder.entityId||(kind&&reminder[fields[kind as keyof typeof fields]]),parent=kind&&id?repo.raw(kind,id):null,recipient=repo.actorForUser(reminder.userId,reminder.workspaceId);
  const timestamp=now.toISOString();if(recipient.role==='none'||!parent||!REMINDER_KINDS.includes(kind)||!repo.canRead(recipient,kind,parent)){repo.save('notifications',{...reminder,deletedAt:timestamp,updatedAt:timestamp,version:reminder.version+1},'delete',actor);continue;}
  repo.save('notifications',{...reminder,title:parent.title||parent.name,entityKind:kind,entityId:id,remindAt:at,reasons:['reminders'],deliveredAt:timestamp,movedToInboxAt:timestamp,snoozedUntil:null,readAt:null,archivedAt:null,updatedAt:timestamp,version:reminder.version+1},'update',actor);
 }
}
