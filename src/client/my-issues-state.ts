import type {Entity} from '../shared/types';
import {compareActivities} from '../shared/activity-history';
export const myIssueTabs=['Assigned','Created','Subscribed','Activity','Shared'] as const;
export type MyIssueTab=typeof myIssueTabs[number];
export function myIssueTab(search:string):MyIssueTab{const value=new URLSearchParams(search).get('tab');return myIssueTabs.includes(value as MyIssueTab)?value as MyIssueTab:'Assigned';}
export function myIssueDisplay(tab:string){return {groupBy:tab==='Assigned'?'focus':tab==='Activity'?'activityAt':'none',orderBy:(tab==='Created'||tab==='Subscribed')?'createdAt':tab==='Activity'?'activityAt':'priority',direction:(tab==='Created'||tab==='Subscribed'||tab==='Activity'?'desc':'asc') as 'desc'|'asc',showEmpty:false,...(tab==='Activity'?{groupCount:'estimate',properties:['estimate','identifier','statusId','priority','assigneeId','projectId','dueDate','labelIds','activityAt']}:{} )};}
export {profileIssueDisplay} from './profile-display';
export function myActivityGroupDate(value:string,now=Date.now()):string{
 const date=new Date(value);if(!Number.isFinite(+date))return '';
 const previousWeek=new Date(now-7*86400000);previousWeek.setDate(previousWeek.getDate()-previousWeek.getDay());previousWeek.setHours(0,0,0,0);
 if(date<previousWeek)date.setDate(date.getDate()-date.getDay());
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
/** A date-only observation uses local noon solely as a grouping key, never an audit timestamp. */
export const observedActivityTime=(summary:any):string=>summary?.at||(summary?.date?summary.date+'T12:00:00':'');
export function myIssueActivity(issues:Entity[],comments:Entity[],activities:Entity[],userId:string|undefined){
 const byIssue=new Map(issues.map(issue=>[issue.id,issue]));
 const byComment=new Map(comments.map(comment=>[comment.id,comment]));
 const commentIssue=(id:string)=>{const seen=new Set<string>();let comment=byComment.get(id);while(comment&&!seen.has(comment.id)){seen.add(comment.id);const candidate=comment.issueId??comment.entityId;if(candidate&&byIssue.has(candidate))return candidate as string;comment=byComment.get(comment.parentId??comment.parentCommentId);}return undefined;};
 const result=new Map<string,string>();
 const assignments=new Map<string,Entity[]>();
 for(const activity of activities)if(activity.changes?.assigneeId){const rows=assignments.get(activity.entityId)||[];rows.push(activity);assignments.set(activity.entityId,rows);}
 for(const rows of assignments.values())rows.sort((a,b)=>compareActivities(b,a));
 const assignedAt=(issue:Entity,event:Entity)=>{
  if(Object.hasOwn(event,'assigneeIdAtEvent'))return event.assigneeIdAtEvent;
  let assignee=issue.assigneeId;
  for(const change of assignments.get(issue.id)||[])if(compareActivities(change,event)>0)assignee=change.changes.assigneeId.from;
  return assignee;
 };
 for(const activity of activities){const id=activity.issueId??(activity.entityKind==='comments'||activity.entityType==='comment'?commentIssue(activity.entityId):activity.entityId);const issue=byIssue.get(id);const own=(activity.actorId??activity.userId)===userId,statusChange=!!activity.changes?.statusId||activity.field==='statusId'||activity.before?.statusId!==undefined&&activity.before.statusId!==activity.after?.statusId;if(!issue||issue.deletedAt||activity.deletedAt||(issue.sourceActivitySummary?.userId===userId&&activity.sourceAnchor)||(!own&&!(assignedAt(issue,activity)===userId&&statusChange)))continue;if(activity.createdAt>(result.get(id)??''))result.set(id,activity.createdAt);}
 for(const issue of byIssue.values()){if(issue.deletedAt)continue;const observed=issue.sourceActivitySummary,at=observedActivityTime(observed);if(observed?.userId===userId&&at>(result.get(issue.id)||''))result.set(issue.id,at);}
 return result;
}

/** Native headers use rounded local-day distance, not calendar-date subtraction. */
export function myActivityGroupLabel(id:string,now=Date.now()):string {
 const date=new Date(id+'T00:00:00'),today=new Date(now);if(!Number.isFinite(+date))return 'No date';
 const midnight=new Date(today);midnight.setHours(0,0,0,0);const yesterday=new Date(midnight);yesterday.setDate(yesterday.getDate()-1);
 const previousWeek=new Date(now-7*86400000);previousWeek.setDate(previousWeek.getDate()-previousWeek.getDay());previousWeek.setHours(0,0,0,0);
 const localTime=(value:Date)=>+value-value.getTimezoneOffset()*60000;
 if(date<previousWeek){const weeks=Math.trunc((localTime(previousWeek)-localTime(date))/(7*86400000))+1;return weeks+' '+(weeks===1?'week':'weeks')+' ago';}
 if(+date===+midnight)return 'Today';if(+date===+yesterday)return 'Yesterday';
 const days=Math.round(Math.abs(localTime(today)-localTime(date))/86400000);return date>today?'in '+days+' '+(days===1?'day':'days'):days+' '+(days===1?'day':'days')+' ago';
}
export function myActivityVerb(activity:Entity|undefined,userId?:string,assigneeId?:string|null):string {
 if(!activity)return 'updated';
 const native=activity.events?.at(-1)?.type;
 if(native)return ({issue_created:'created',issue_updated:'updated',issue_deleted:'deleted',assigned_issue_state_changed:'changed status',issue_commented:'commented',issue_reacted:'reacted',comment_reacted:'reacted',opened_pull_request:'linked PR'} as Record<string,string>)[native]||'updated';
 if((activity.changes?.statusId||activity.field==='statusId'||activity.sourceAnchor?.endsWith('-state-change'))&&(Object.hasOwn(activity,'assigneeIdAtEvent')?activity.assigneeIdAtEvent:assigneeId)===userId)return 'changed status';
 if(activity.changes?.reactions)return 'reacted';
 if(activity.entityKind==='comments')return 'commented';
 if((activity.actorId??activity.userId)!==userId&&activity.changes?.statusId)return 'changed status';
 return activity.action==='create'?'created':activity.action==='delete'?'deleted':'updated';
}

/** Recent dates show day/month; distant dates show month/year, matching native rows. */
export function myActivityDateLabel(value:string,now=Date.now()):string {
 const date=new Date(value);if(!Number.isFinite(+date))return '';
 const current=new Date(now),past=new Date(current.getFullYear(),current.getMonth()-6,1);
 const future=new Date(current);future.setDate(1);future.setMonth(future.getMonth()+6);
 const finalDay=new Date(future.getFullYear(),future.getMonth()+1,0).getDate();future.setDate(Math.min(current.getDate(),finalDay));
 return date.toLocaleDateString('en-US',date<past||date>future?{month:'short',year:'numeric'}:{month:'short',day:'numeric'});
}
