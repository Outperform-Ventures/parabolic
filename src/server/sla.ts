import { classifySla } from '../shared/sla-status';
import {pendingIssueSubscribers} from '../shared/issue-subscriptions';
import {teamMembers} from './team-hierarchy';
import {cycleAddition} from '../shared/cycle-addition';
import { advanceOccurrence } from './calendar.ts';
import { randomUUID } from 'node:crypto';
import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';

export const slaStatus = classifySla;
export function slaRiskThresholds(due:Date,business:boolean,workWeek='mon-fri',timeZone='UTC') {
 const before=(days:number)=>{if(!business)return new Date(due.getTime()-days*86400000).toISOString();let date=due,left=days;const weekday=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone});while(left){date=advanceOccurrence(date,{frequency:'daily',interval:-1,timeZone});const day=weekday.format(date);if(workWeek==='sun-thu'?!['Fri','Sat'].includes(day):!['Sat','Sun'].includes(day))left--;}return date.toISOString();};
 return {slaHighRiskAt:before(1),slaMediumRiskAt:before(7)};
}
export function slaDeadline(from:Date,value:number,unit:string,workWeek='mon-fri',timeZone='UTC'){
  assert(Number.isFinite(value)&&value>0&&value<=3650,422,'SLA duration must be positive and no greater than 3650','VALIDATION_ERROR');assert(['hour','day','businessDay','week','minute'].includes(unit),422,'Invalid SLA duration unit','VALIDATION_ERROR');
  if(unit==='hour'||unit==='minute')return new Date(from.getTime()+value*(unit==='hour'?3600000:60000));
  if(unit==='businessDay'){assert(Number.isInteger(value),422,'Business-day duration must be a whole number','VALIDATION_ERROR');let date=from,remaining=value;const weekday=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone});while(remaining>0){date=advanceOccurrence(date,{frequency:'daily',timeZone});const day=weekday.format(date);if(workWeek==='sun-thu'?!['Fri','Sat'].includes(day):!['Sat','Sun'].includes(day))remaining--;}return date;}
  return new Date(from.getTime()+value*(unit==='week'?7:1)*86400000);
}
export function applySla(repo:Repository,actor:Actor,issue:RecordEntity,previous:RecordEntity|undefined,patch:Record<string,any>,matches:(entity:any,filter:any)=>boolean,now=new Date()){
  const team=repo.raw('teams',issue.teamId),workspace=repo.raw('workspaces',actor.workspaceId);const zone=team?.timezone||workspace?.timezone||'UTC',week=workspace?.workWeek||'mon-fri';
  const clear=()=>{issue.slaDueAt=null;issue.slaStartedAt=null;issue.slaPolicyId=null;issue.slaDuration=null;issue.slaHighRiskAt=null;issue.slaMediumRiskAt=null;issue.slaStatus=null;issue.slaBreachedAt=null;issue.slaRiskAt=null;issue.slaRiskNotifiedAt=null;issue.slaBreachNotifiedAt=null;};
  const apply=(value:number,unit:string,policyId:string|null,manual=false)=>{issue.slaStartedAt=now.toISOString();issue.slaDueAt=slaDeadline(now,value,unit,week,zone).toISOString();issue.slaDuration={value,unit};issue.slaPolicyId=policyId;issue.slaManual=manual;issue.dueDate=null;issue.slaBreachedAt=null;issue.slaRiskAt=null;issue.slaRiskNotifiedAt=null;issue.slaBreachNotifiedAt=null;};
  const explicitManual=Object.hasOwn(patch,'slaDuration');const explicitPolicy=Object.hasOwn(patch,'slaPolicyId')&&patch.slaPolicyId!==previous?.slaPolicyId;
  const timerUpdate=actor.system&&Object.keys(patch).every(key=>['slaStatus','slaBreachedAt','slaRiskAt','slaRiskNotifiedAt','slaBreachNotifiedAt'].includes(key));
  if(explicitManual){if(!patch.slaDuration)clear();else apply(Number(patch.slaDuration.value),patch.slaDuration.unit,null,true);}
  else if(Object.hasOwn(patch,'dueDate')&&patch.dueDate)clear();
  else if(Object.hasOwn(patch,'slaDueAt')&&patch.slaDueAt===null&&!explicitPolicy)clear();
  else if(explicitPolicy&&patch.slaPolicyId){const policy=repo.raw('slaPolicies',patch.slaPolicyId);if(policy){if(policy.action==='remove')clear();else apply(Number(policy.duration||policy.durationMinutes),policy.durationUnit||'minute',policy.id);}}
  else if(!issue.completedAt&&!timerUpdate){
    const project=issue.projectId?repo.raw('projects',issue.projectId):null;const enriched={...issue,subscribers:pendingIssueSubscribers(issue,previous,actor.userId),cycleAddition:cycleAddition(issue,issue.cycleId?repo.raw('cycles',issue.cycleId):null),project,projectStatus:project?.status,initiativeId:project?.initiativeId||issue.initiativeId,initiativeIds:project?.initiativeIds||[],slaStatus:slaStatus(issue,now.getTime())};
    const rules=repo.all('slaPolicies',actor.workspaceId).filter(policy=>policy.enabled!==false&&(!policy.teamId||policy.teamId===issue.teamId)).sort((a,b)=>(a.position||0)-(b.position||0)||a.createdAt.localeCompare(b.createdAt));
    const rule=rules.find(policy=>matches(enriched,repo.resolveFilter(actor,policy.filter)));
    if(rule?.action==='remove')clear();
    else if(rule&&!(previous&&!previous.slaDueAt&&previous.priority>0&&previous.priority===issue.priority&&Date.parse(rule.createdAt)>Date.parse(previous.createdAt))){if(issue.slaPolicyId!==rule.id||!issue.slaDueAt)apply(Number(rule.duration||rule.durationMinutes),rule.durationUnit||'minute',rule.id);}
    else if(!previous&&!issue.slaDueAt&&team?.slaPolicyId){const policy=repo.raw('slaPolicies',team.slaPolicyId);if(policy?.enabled!==false&&policy)apply(Number(policy.duration||policy.durationMinutes),policy.durationUnit||'minute',policy.id);}
  }
  issue.slaCanceled=['canceled','duplicate'].includes(repo.raw('statuses',issue.statusId)?.type);
  if(issue.slaDueAt){Object.assign(issue,slaRiskThresholds(new Date(issue.slaDueAt),issue.slaDuration?.unit==='businessDay',week,zone));issue.dueDate=null;issue.slaStatus=slaStatus(issue,now.getTime());if(issue.slaStatus==='breached'||issue.slaStatus==='failed')issue.slaBreachedAt ||=issue.slaDueAt;if(issue.slaStatus==='highRisk')issue.slaRiskAt ||=now.toISOString();}
}

export function slaNotifications(repo:Repository,actor:Actor,issue:RecordEntity,now:Date){
  if(!issue.slaDueAt||issue.completedAt||issue.slaCanceled)return;const status=slaStatus(issue,now.getTime());let type:string|undefined;
  if(status==='breached'&&!issue.slaBreachNotifiedAt)type='slaBreached';else if(status==='highRisk'&&!issue.slaRiskNotifiedAt)type='slaAtRisk';if(!type)return;
  const recipients=new Set<string>(issue.subscriberIds||[]);for(const subscription of repo.all('subscriptions',actor.workspaceId))if(subscription.issueId===issue.id||subscription.entityId===issue.id)recipients.add(subscription.userId);
  const team=issue.teamId?repo.raw('teams',issue.teamId):null;
  const members=new Set(team?teamMembers(repo,team):[]);
  for(const user of repo.all('users',actor.workspaceId)){const preferences=user.preferences?.notifications||{};if(preferences.teamSla&&members.has(user.id)&&repo.canRead(repo.actorForUser(user.id,actor.workspaceId),'issues',issue))recipients.add(user.id);}
  for(const userId of recipients){const recipient=repo.actorForUser(userId,actor.workspaceId);if(recipient.role==='none'||!repo.canRead(recipient,'issues',issue))continue;const at=now.toISOString();repo.save('notifications',{id:randomUUID(),workspaceId:actor.workspaceId,createdAt:at,updatedAt:at,version:1,userId,actorId:actor.userId,issueId:issue.id,entityKind:'issues',entityId:issue.id,type,reasons:['sla',type],title:type==='slaBreached'?`${issue.identifier} breached its SLA`:`${issue.identifier} is approaching its SLA`,body:issue.title,readAt:null,archivedAt:null},'create',actor);}
  repo.update(actor,'issues',issue.id,{[type==='slaBreached'?'slaBreachNotifiedAt':'slaRiskNotifiedAt']:now.toISOString(),slaStatus:slaStatus(issue,now.getTime())});
}
