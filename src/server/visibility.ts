import {guestOperationalAccess} from './guest-access';
import {isTeamOwner} from './team-permissions';
import {requesterIdentity} from './requester-attribution';
import {askPageTemplates} from './asks-pages';
import {cycleAddition} from '../shared/cycle-addition';
import type {Actor,RecordEntity,Repository} from './repository.ts';
import {assert} from './errors.ts';
import {teamAccess,teamMembers,teamAncestors} from './team-hierarchy.ts';

const restrictedIssueFields=['teamId','projectId','cycleId','milestoneId','cycleAddedAt','cycleAddition'];
export function sharedIssueAccess(repo:Repository,actor:Actor,entity:RecordEntity){
  if(actor.system)return false;const team=repo.cachedRaw(actor,'teams',entity.teamId,true);if(!team||teamAccess(repo,actor,team))return false;const current=repo.cachedRaw(actor,'issues',entity.id,true)||entity;const seen=new Set<string>();let issue:RecordEntity|null=current;
  while(issue&&!seen.has(issue.id)){seen.add(issue.id);const issueTeam=repo.cachedRaw(actor,'teams',issue.teamId,true);if(Object.hasOwn(issue,'sharedWithIds')&&issue.sharedWithIds!==null)return !!issueTeam?.issueSharingEnabled&&(issue.sharedWithIds?.includes(actor.userId)||false);issue=issue.parentId?repo.cachedRaw(actor,'issues',issue.parentId,true):null;}
  return false;
}
export function mayManageSharing(repo:Repository,actor:Actor,issue:RecordEntity){const team=repo.cachedRaw(actor,'teams',issue.teamId,true);if(!team?.issueSharingEnabled)return false;const owner=isTeamOwner(repo,actor,team);if(!teamMembers(repo,team).includes(actor.userId)&&!owner)return false;return team.issueSharingPolicy!=='owners'||owner;}
export function mayGuestEdit(repo:Repository,actor:Actor,kind:string,entity?:RecordEntity){if(kind==='users')return !!entity&&entity.id===actor.userId;if(guestOperationalAccess(repo,actor,kind,entity))return true;if(kind==='notifications')return !entity||entity.userId===actor.userId;if(kind==='favorites'||kind==='subscriptions'){if(!entity)return true;if(entity.userId!==actor.userId)return false;if(kind==='favorites'&&entity.type==='folder')return true;const targetKind=entity.issueId?'issues':entity.projectId?'projects':entity.entityKind||({issue:'issues',project:'projects',view:'views',customer:'customers'} as any)[entity.type],id=entity.issueId||entity.projectId||entity.entityId;const target=targetKind&&id?repo.raw(targetKind,id):null;return !!target&&repo.canRead({...actor,scopes:[...actor.scopes,'read']},targetKind,target);}if(kind==='issues')return !!entity&&sharedIssueAccess(repo,actor,entity);if(kind==='comments'){if(!entity)return true;const issue=entity.issueId?repo.raw('issues',entity.issueId):null;return !!issue&&sharedIssueAccess(repo,actor,issue);}return false;}
export function validateSharedIssuePatch(repo:Repository,actor:Actor,previous:RecordEntity,patch:Record<string,any>){if(sharedIssueAccess(repo,actor,previous))for(const field of [...restrictedIssueFields,'parentId','sharedWithIds','templateId','archivedAt','duplicateOfId','convertedToProjectId'])if(Object.hasOwn(patch,field))assert(JSON.stringify(patch[field])===JSON.stringify(previous[field]),403,'Shared issue access cannot change team, project, cycle, milestone or sharing','SHARED_ISSUE_RESTRICTED');}
export function validateIssueSharing(repo:Repository,actor:Actor,issue:RecordEntity,previous?:RecordEntity){
  if(issue.sharedWithIds===null){assert(issue.parentId,422,'Only sub-issues can inherit parent sharing','INVALID_ISSUE_SHARING');assert(actor.system||mayManageSharing(repo,actor,issue),403,'Only team members may restore inherited sharing','SHARING_FORBIDDEN');delete issue.sharedWithIds;}
  if(Object.hasOwn(issue,'sharedWithIds')){assert(Array.isArray(issue.sharedWithIds)&&issue.sharedWithIds.length<=100&&issue.sharedWithIds.every((id:any)=>typeof id==='string'&&repo.role(id,actor.workspaceId)!=='none'),422,'Shared people must be workspace members','INVALID_ISSUE_SHARING');issue.sharedWithIds=[...new Set(issue.sharedWithIds)];if(JSON.stringify(issue.sharedWithIds)!==JSON.stringify(previous?.sharedWithIds))assert(actor.system||mayManageSharing(repo,actor,issue),403,'Issue sharing is disabled or restricted to team owners','SHARING_FORBIDDEN');}
  const team=repo.raw('teams',issue.teamId);if(team?.private&&issue.assigneeId&&issue.assigneeId!==previous?.assigneeId){const recipient=repo.actorForUser(issue.assigneeId,actor.workspaceId);assert(actor.system||repo.canRead(recipient,'issues',issue),422,'Assignee must have access to this private issue','INVALID_ASSIGNEE');}
}
const singleRefs:Record<string,string>={teamId:'teams',projectId:'projects',initiativeId:'initiatives',cycleId:'cycles',milestoneId:'milestones',issueId:'issues',documentId:'documents',updateId:'updates'};
const arrayRefs:Record<string,string>={teamIds:'teams',projectIds:'projects',initiativeIds:'initiatives',blockedByIds:'issues',blockingIds:'issues',relatedIds:'issues',dependencyIds:'projects',templateIds:'templates'};
export function presentEntity(repo:Repository,actor:Actor,kind:string,entity:RecordEntity):RecordEntity{
  if(actor.system)return entity;const value={...entity};if(kind==='users'){value.workspaceId=actor.workspaceId;if(entity.id!==actor.userId)for(const key of Object.keys(value))if(!['id','workspaceId','name','username','email','color','avatar','avatarUrl','createdAt','updatedAt','version','joinedAt','joinedDisplay','lastSeenAt','roleLabel','teamCount','profileUrl'].includes(key))delete value[key];}const reader={...actor,scopes:[...actor.scopes,'read']};const visible=(target:string,id:string)=>{const record=repo.cachedRaw(reader,target,id,true);return !!record&&repo.canRead(reader,target,record);};
  for(const [field,id] of [['creatorIdentity',entity.creatorId],...(kind==='activities'?[['actorIdentity',entity.actorId]]:[])] as [string,string][]){
    const stored=entity[field];delete value[field];
    if(id&&!repo.cachedRaw(reader,'users',id,true)){const identity=requesterIdentity(repo,actor.workspaceId,id);if(identity)value[field]=stored?.kind==='requester'&&stored.id===id&&typeof stored.name==='string'?{...identity,name:stored.name}:identity;}
  }
  for(const [field,target] of Object.entries(singleRefs))if(value[field]&&!visible(target,value[field]))value[field]=null;
  for(const [field,target] of Object.entries(arrayRefs))if(Array.isArray(value[field]))value[field]=value[field].filter((id:string)=>visible(target,id));
  if((kind==='teams'||kind==='initiatives')&&value.parentId&&!visible(kind,value.parentId))value.parentId=null;
  if(kind==='initiatives'&&value.parentIds)value.parentIds=value.parentIds.filter((id:string)=>visible(kind,id));
  if(kind==='issues'){
    if(value.triageRuleConflicts)value.triageRuleConflicts=value.triageRuleConflicts.map((conflict:any)=>({...conflict,ruleId:conflict.ruleId&&visible('automations',conflict.ruleId)?conflict.ruleId:''}));
    value.sharedAccess=sharedIssueAccess(repo,actor,entity);value.canManageSharing=mayManageSharing(repo,actor,entity);
    if(value.relations)value.relations=value.relations.filter((relation:any)=>visible('issues',relation.issueId));if(value.duplicateOfId&&!visible('issues',value.duplicateOfId))value.duplicateOfId=null;
    if(value.sharedAccess){for(const field of restrictedIssueFields)value[field]=null;const team=repo.raw('teams',entity.teamId)!;const labelScopes=new Set([team.id,...teamAncestors(repo,team).map(t=>t.id)]);value.sharedLabels=repo.all('labels',actor.workspaceId).filter(label=>(label.entityType||'issues')==='issues'&&(!label.teamId||labelScopes.has(label.teamId))).map(label=>({id:label.id,name:label.name,color:label.color,group:label.group}));value.sharedEstimateConfig={estimateScale:team.estimateScale||'Fibonacci',extendedEstimates:!!team.extendedEstimates,zeroEstimate:team.zeroEstimate!==false,unestimatedAsOne:team.unestimatedAsOne!==false};value.sharedStatuses=repo.all('statuses',actor.workspaceId).filter(s=>s.teamId===entity.teamId).map(s=>({id:s.id,name:s.name,type:s.type,color:s.color,position:s.position}));if(value.parentId&&!visible('issues',value.parentId))value.parentId=null;delete value.triageOwnerId;delete value.slaPolicyId;delete value.templateId;}
  }
  if(kind==='issues'){value.cycleAddition=cycleAddition(value,value.cycleId?repo.cachedRaw(reader,'cycles',value.cycleId):null);if(!value.cycleId)value.cycleAddedAt=null;}
  if(kind==='activities'&&value.initialStatusId&&!visible('statuses',value.initialStatusId))value.initialStatusId=null;
  if(kind==='activities'&&value.changes&&value.entityKind&&value.entityId){const parent=repo.cachedRaw(reader,value.entityKind,value.entityId,true);if(parent){const changes={...value.changes};for(const [field,change] of Object.entries(changes) as [string,any][]){if(singleRefs[field]){const next={...change};for(const side of ['from','to'])if(next[side]&&!visible(singleRefs[field],next[side]))next[side]=null;changes[field]=next;}else if(arrayRefs[field]){const next={...change};for(const side of ['from','to'])if(Array.isArray(next[side]))next[side]=next[side].filter((id:string)=>visible(arrayRefs[field],id));changes[field]=next;}}if(value.entityKind==='issues'&&sharedIssueAccess(repo,actor,parent))for(const field of [...restrictedIssueFields,'templateId','slaPolicyId'])delete changes[field];value.changes=changes;}}
  if(kind==='asksPages')value.templateIds=askPageTemplates(repo,actor,entity).map(template=>template.id);
  return value;
}
export function preserveHiddenProjectTeams(repo:Repository,actor:Actor,previous:RecordEntity,patch:Record<string,any>){
  const reader={...actor,scopes:[...actor.scopes,'read']};const hidden=(id:string)=>{const team=repo.raw('teams',id,true);return !!team&&!repo.canRead(reader,'teams',team);};
  if(Object.hasOwn(patch,'teamIds')&&Array.isArray(patch.teamIds))patch.teamIds=[...new Set([...patch.teamIds,...(previous.teamIds||[]).filter(hidden)])];if(Object.hasOwn(patch,'teamId')&&previous.teamId&&hidden(previous.teamId))patch.teamId=previous.teamId;
}
