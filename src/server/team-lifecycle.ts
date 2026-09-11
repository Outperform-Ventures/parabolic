import {assert} from './errors';
import {isTeamOwner} from './team-permissions';
import type {Actor,RecordEntity,Repository} from './repository';

const DAY=86_400_000;
export function retiredTeamFor(repo:Repository,kind:string,e:RecordEntity,seen=new Set<string>()):RecordEntity|null{
 const key=kind+':'+e.id;if(seen.has(key))return null;seen.add(key);
 if(kind==='teams')return e.retiredAt||e.archivedAt?e:null;
 if(kind==='projects'){
  const ids=[...new Set<string>([...(e.teamIds||[]),...(e.teamId?[e.teamId]:[])])];
  const teams=ids.map(id=>repo.raw('teams',id,true));
  return teams.length&&teams.every(t=>t&&(t.retiredAt||t.archivedAt||t.deletedAt))?teams[0]:null;
 }
 if(e.teamId){const team=repo.raw('teams',e.teamId,true);if(team&&(team.retiredAt||team.archivedAt||team.deletedAt))return team;}
 for(const [field,parentKind]of [['issueId','issues'],['projectId','projects'],['documentId','documents'],['updateId','updates']] as const){if(e[field]){const parent=repo.raw(parentKind,e[field],true);if(parent){const team=retiredTeamFor(repo,parentKind,parent,seen);if(team)return team;}}}
 return null;
}
export function assertTeamWritable(repo:Repository,actor:Actor,kind:string,e:RecordEntity){
 if(actor.system||['activities','notifications','favorites','subscriptions','users','workspaces'].includes(kind))return;
 assert(!retiredTeamFor(repo,kind,e),403,'This team is retired. Its work is read-only until the team is restored.','TEAM_RETIRED');
}
function authorize(repo:Repository,actor:Actor,id:string){const team=repo.get(actor,'teams',id,true);assert(repo.hasScope(actor,'teams',true),403,'Team write access required','FORBIDDEN');assert(isTeamOwner(repo,actor,team),403,'Only team owners or administrators can retire, delete, or restore a team','TEAM_OWNER_REQUIRED');assert(!team.permanentlyDeleted,422,'This team was permanently deleted','PERMANENTLY_DELETED');return team;}
function save(repo:Repository,actor:Actor,kind:string,e:RecordEntity,patch:Record<string,any>,action='update'){
 const changed={...e,...patch,updatedAt:(actor.now||new Date()).toISOString(),version:e.version+1};repo.save(kind,changed,action,actor);repo.activity(actor,kind,changed,action,e);return changed;
}
export function previewTeamLifecycle(repo:Repository,actor:Actor,id:string){
 const team=authorize(repo,actor,id),issues=repo.all('issues',actor.workspaceId).filter(i=>i.teamId===id),activeIssues=issues.filter(i=>!['completed','canceled','cancelled','duplicate'].includes(repo.raw('statuses',i.statusId)?.type));
 const subteams=repo.all('teams',actor.workspaceId).filter(t=>t.parentId===id),projects=repo.all('projects',actor.workspaceId).filter(p=>{const ids=[...new Set([...(p.teamIds||[]),...(p.teamId?[p.teamId]:[])])];return ids.includes(id)&&ids.every(other=>other===id||!!repo.raw('teams',String(other),true)?.archivedAt);});
 return {team,issueCount:issues.length,activeIssueCount:activeIssues.length,readOnlyProjectCount:projects.length,subteams:subteams.map(t=>({id:t.id,name:t.name})),restoreUntil:team.deletedAt?new Date(Date.parse(team.deletedAt)+30*DAY).toISOString():null};
}
export function teamLifecycle(repo:Repository,actor:Actor,id:string,input:Record<string,any>){return repo.transaction(()=>{
 const team=authorize(repo,actor,id),now=actor.now||new Date(),at=now.toISOString();
 if(input.version!==undefined)assert(input.version===team.version,409,'The team changed. Reload the review before continuing.','VERSION_CONFLICT');
 assert(['retire','delete','restore'].includes(input.action),422,'Choose a valid team action','INVALID_OPERATION');
 if(input.action==='restore'){
  assert(!team.deletedAt||now.getTime()-Date.parse(team.deletedAt)<30*DAY,422,'The 30-day restoration period has ended','PERMANENTLY_DELETED');
  if(team.deletedAt){
   const cohort=team.teamDeletionCohort;assert(cohort,422,'This team has no restorable deletion cohort','INVALID_OPERATION');
   const records=repo.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND json_extract(data,'$.teamDeletionCohort')=?").all(actor.workspaceId,cohort) as {kind:string,data:string}[];
   for(const row of records){const e=JSON.parse(row.data);save(repo,actor,row.kind,e,{deletedAt:null,teamDeletionCohort:null},'restore');}
   return repo.raw('teams',id)!;
  }
  return save(repo,actor,'teams',team,{retiredAt:null,archivedAt:null});
 }
 assert(!team.deletedAt,422,'Restore this deleted team before changing it','TEAM_DELETED');
 const children=repo.all('teams',actor.workspaceId).filter(t=>t.parentId===id);
 assert(!children.length||input.subteams==='detach',422,'Choose how to handle sub-teams before continuing','SUBTEAMS_REQUIRE_RESOLUTION');
 for(const child of children){assert(isTeamOwner(repo,actor,child)&&repo.canRead(actor,'teams',child),403,'You must be able to manage every sub-team','TEAM_OWNER_REQUIRED');repo.update(actor,'teams',child.id,{parentId:null});}
 if(input.action==='retire'){
  assert(!team.retiredAt&&!team.archivedAt,422,'This team is already retired','TEAM_RETIRED');
  assert(['cancel','move'].includes(input.issues||'cancel'),422,'Choose whether to cancel issues or move them to a team','INVALID_OPERATION');
  const destination=input.issues==='move'?repo.get(actor,'teams',input.destinationTeamId):null;
  if(destination){assert(destination.id!==id&&!destination.deletedAt&&!destination.archivedAt,422,'Choose another active team','INVALID_DESTINATION');assertTeamWritable(repo,actor,'teams',destination);}
  const statuses=repo.all('statuses',actor.workspaceId);
  for(const issue of repo.all('issues',actor.workspaceId).filter(i=>i.teamId===id)){
   const status=repo.raw('statuses',issue.statusId);if(['completed','canceled','cancelled','duplicate'].includes(status?.type))continue;
   const target=destination?(statuses.find(s=>s.teamId===destination.id&&s.type===status?.type&&s.name===status?.name)||statuses.find(s=>s.teamId===destination.id&&s.type===status?.type)||statuses.find(s=>s.teamId===destination.id&&s.type==='unstarted')):statuses.find(s=>s.teamId===id&&['canceled','cancelled'].includes(s.type));
   assert(target,422,'The destination workflow needs an appropriate status','INVALID_WORKFLOW');
   repo.update(actor,'issues',issue.id,{statusId:target.id,...(destination?{teamId:destination.id,cycleId:null}:{})});
  }
  return save(repo,actor,'teams',repo.raw('teams',id)!,{retiredAt:at,archivedAt:at});
 }
 assert(input.name===team.name,422,'Type the team name to confirm deletion','CONFIRMATION_REQUIRED');
 // Mark only currently live records; restoring this cohort must never revive older trash.
 const cohort=id+':'+at,records=repo.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND deleted_at IS NULL").all(actor.workspaceId) as {kind:string,data:string}[],selected=new Map<string,{kind:string,e:RecordEntity}>();
 for(const row of records){const e=JSON.parse(row.data);if((row.kind==='teams'&&e.id===id)||(e.teamId===id&&row.kind!=='projects'))selected.set(e.id,{kind:row.kind,e});}
 let changed=true;while(changed){changed=false;for(const row of records){const e=JSON.parse(row.data);if(selected.has(e.id)||!['comments','activities','updates','documents','notifications','subscriptions','favorites','requests'].includes(row.kind))continue;if(['issueId','documentId','updateId','entityId'].some(field=>selected.has(e[field]))){selected.set(e.id,{kind:row.kind,e});changed=true;}}}
 for(const {kind,e}of selected.values())save(repo,actor,kind,e,{deletedAt:at,teamDeletionCohort:cohort},'delete');
 return repo.raw('teams',id,true)!;
});}
