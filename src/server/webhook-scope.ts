import {assert} from './errors.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';

export type WebhookScope={teamId:string|null;allPublicTeams:boolean};
export function webhookScope(repo:Repository,actor:Actor,fields:Record<string,any>,previous?:Record<string,any>):WebhookScope {
  const teamId=Object.hasOwn(fields,'teamId')?fields.teamId:previous?.team_id??null;
  const allPublicTeams=Object.hasOwn(fields,'allPublicTeams')?fields.allPublicTeams:!!previous?.all_public_teams;
  assert(teamId==null||typeof teamId==='string'&&teamId.length>0,422,'Choose a valid webhook team','INVALID_WEBHOOK_SCOPE');
  assert(typeof allPublicTeams==='boolean'&&!(teamId&&allPublicTeams),422,'Choose one team or all public teams','INVALID_WEBHOOK_SCOPE');
  if(teamId)repo.get(actor,'teams',teamId);
  return {teamId:teamId??null,allPublicTeams};
}
function publicTeam(repo:Repository,id:string,seen=new Set<string>()):boolean {
  if(seen.has(id))return false;seen.add(id);
  const team=repo.raw('teams',id,true);
  if(!team||team.private||['private','restricted'].includes(team.visibility))return false;
  return !team.parentId||publicTeam(repo,team.parentId,seen);
}
const parentFields:Record<string,string>={issueId:'issues',documentId:'documents',updateId:'updates',milestoneId:'milestones',projectId:'projects',initiativeId:'initiatives',cycleId:'cycles'};
function parents(repo:Repository,entity:RecordEntity):[string,RecordEntity][] {
  const result:[string,RecordEntity][]=[];
  for(const[field,kind]of Object.entries(parentFields))if(entity[field]){const parent=repo.raw(kind,entity[field],true);if(parent)result.push([kind,parent]);}
  if(entity.entityKind&&entity.entityId){const parent=repo.raw(entity.entityKind,entity.entityId,true);if(parent)result.push([entity.entityKind,parent]);}
  return result;
}
function teamIds(repo:Repository,kind:string,entity:RecordEntity,seen=new Set<string>()):string[] {
  const key=kind+':'+entity.id;if(seen.has(key))return [];seen.add(key);
  const ids=new Set<string>([...(entity.teamIds||[]),...(entity.teamId?[entity.teamId]:[]),...(entity.leadTeamId?[entity.leadTeamId]:[]),...(kind==='teams'?[entity.id]:[])]);
  // A private issue in a shared project belongs to its own team. Its project's
  // other teams must not widen the issue event's subscription scope.
  if(ids.size)return [...ids];
  for(const[parentKind,parent]of parents(repo,entity))return teamIds(repo,parentKind,parent,seen);
  return [];
}
function publicParents(repo:Repository,entity:RecordEntity,seen=new Set<string>()):boolean {
  if(seen.has(entity.id))return true;seen.add(entity.id);
  if(['private','personal'].includes(entity.visibility))return false;
  return parents(repo,entity).every(([,parent])=>publicParents(repo,parent,seen));
}
export function webhookMatches(repo:Repository,hook:Record<string,any>,kind:string,entity:RecordEntity):boolean {
  if(!hook.team_id&&!hook.all_public_teams)return true;
  if(hook.all_public_teams&&!publicParents(repo,entity))return false;
  const ids=teamIds(repo,kind,entity);
  if(hook.team_id)return ids.includes(hook.team_id);
  return !ids.length||ids.some(id=>publicTeam(repo,id));
}
const singleRefs:Record<string,string>={...parentFields,teamId:'teams',leadTeamId:'teams',statusId:'statuses',initialStatusId:'statuses',duplicateOfId:'issues'};
const arrayRefs:Record<string,string>={teamIds:'teams',projectIds:'projects',initiativeIds:'initiatives',blockedByIds:'issues',blockingIds:'issues',relatedIds:'issues',dependencyIds:'projects',labelIds:'labels'};
export function webhookEntity(repo:Repository,actor:Actor,hook:Record<string,any>,kind:string,entity:RecordEntity) {
  const result={...repo.present(actor,kind,entity)};
  if(!hook.all_public_teams)return result;
  const visible=(target:string,id:string)=>{const value=repo.raw(target,id,true);return !!value&&webhookMatches(repo,hook,target,value);};
  for(const[field,target]of Object.entries(singleRefs))if(result[field]&&!visible(target,result[field]))result[field]=null;
  for(const[field,target]of Object.entries(arrayRefs))if(Array.isArray(result[field]))result[field]=result[field].filter((id:string)=>visible(target,id));
  if(result.parentId&&!visible(kind,result.parentId))result.parentId=null;
  if(kind==='initiatives'&&result.parentIds)result.parentIds=result.parentIds.filter((id:string)=>visible(kind,id));
  if(kind==='issues'&&result.relations)result.relations=result.relations.filter((relation:any)=>visible('issues',relation.issueId));
  if(kind==='activities'&&result.changes){result.changes={...result.changes};for(const[field,change]of Object.entries(result.changes) as [string,any][]){const target=singleRefs[field]||arrayRefs[field];if(!target)continue;const next={...change};for(const side of ['from','to'])if(arrayRefs[field]&&Array.isArray(next[side]))next[side]=next[side].filter((id:string)=>visible(target,id));else if(next[side]&&!visible(target,next[side]))next[side]=null;result.changes[field]=next;}}
  return result;
}
