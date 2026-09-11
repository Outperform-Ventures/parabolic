import {randomUUID} from 'node:crypto';
import {effectiveIssueSubscribers} from '../shared/issue-subscriptions';
import type {Actor,RecordEntity,Repository} from './repository';

// Provisional policy pending native comparison: near means the preceding local
// calendar day or the due day; subscriptions are opt-in. This is not SLA timing.
export const dueDateNotificationPolicy={nearCalendarDays:1};
function calendarDay(now:Date,zone:string){
 let parts:Intl.DateTimeFormatPart[];try{parts=new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)}catch{parts=new Intl.DateTimeFormat('en',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)}
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dueDateNotifications(repo:Repository,actor:Actor,issue:RecordEntity,now:Date){
 if(!issue.dueDate||issue.slaDueAt||issue.deletedAt||issue.archivedAt||issue.completedAt)return;
 const status=issue.statusId?repo.raw('statuses',issue.statusId):null;if(['completed','canceled'].includes(status?.type))return;
 const date=String(issue.dueDate);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return;
 const team=issue.teamId?repo.raw('teams',issue.teamId):null,workspace=repo.raw('workspaces',issue.workspaceId),today=calendarDay(now,team?.timezone||workspace?.timezone||'UTC'),days=(Date.parse(date)-Date.parse(today))/86400000;
 const type=days<0?'dueDateOverdue':days<=dueDateNotificationPolicy.nearCalendarDays?'dueDateNear':null;if(!type)return;
 repo.transaction(()=>{for(const userId of effectiveIssueSubscribers(issue)){
  const user=repo.raw('users',userId);if(user?.preferences?.notifications?.[type]!==true)continue;
  const recipient=repo.actorForUser(userId,issue.workspaceId);if(recipient.role==='none'||!repo.canRead(recipient,'issues',issue))continue;
  const key=`due-date:${issue.workspaceId}:${issue.id}:${date}:${userId}:${type}`;if(repo.db.prepare('SELECT key FROM scheduler_runs WHERE key=?').get(key))continue;
  const at=now.toISOString();repo.save('notifications',{id:randomUUID(),workspaceId:issue.workspaceId,createdAt:at,updatedAt:at,version:1,userId,issueId:issue.id,entityKind:'issues',entityId:issue.id,type,reasons:[type],title:`${issue.identifier} ${type==='dueDateOverdue'?'is overdue':'is due soon'}`,body:issue.title,dueDate:date,readAt:null,archivedAt:null},'create',actor);
  repo.db.prepare('INSERT INTO scheduler_runs VALUES(?,?)').run(key,at);
 }});
}

/** Due alerts retain their original arrival/read state when the issue is completed. */
export function refreshDueDateNotificationTitles(repo:Repository,actor:Actor,issue:RecordEntity,previous?:RecordEntity){
 if(previous&&issue.completedAt===previous.completedAt&&issue.statusId===previous.statusId&&issue.identifier===previous.identifier)return;
 const type=repo.raw('statuses',issue.statusId)?.type,closed=!!issue.completedAt||['completed','canceled','duplicate'].includes(type);
 const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='notifications' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.issueId')=? AND json_extract(data,'$.type') IN ('dueDateNear','dueDateOverdue')").all(issue.workspaceId,issue.id) as {data:string}[];
 for(const row of rows){const n=JSON.parse(row.data),title=`${issue.identifier} ${closed?(type==='canceled'?'was canceled':type==='duplicate'?'was marked duplicate':'was completed'):n.type==='dueDateOverdue'?'is overdue':'is due soon'}`;if(n.title===title)continue;repo.save('notifications',{...n,title,issueCompletedAt:closed?issue.completedAt||null:null,updatedAt:(actor.now||new Date()).toISOString(),version:n.version+1},'update',actor);}
}
