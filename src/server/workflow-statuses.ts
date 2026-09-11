import {assert} from './errors.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';

export const NORMAL_WORKFLOW_CATEGORIES=new Set(['backlog','unstarted','started','completed','canceled']);

export function validateWorkflowStatus(repo:Repository,actor:Actor,status:RecordEntity,previous?:RecordEntity){
  assert(!repo.raw('teams',status.teamId)?.inheritStatuses||actor.hierarchySync,422,'Edit the inherited definition on the parent team','INHERITED_SETTING');
  assert(['triage',...NORMAL_WORKFLOW_CATEGORIES,'duplicate'].includes(status.type),422,'Invalid workflow category','VALIDATION_ERROR');
  assert(!previous||status.type===previous.type,422,'An existing workflow status category cannot be changed. Create a status in the desired category instead.','IMMUTABLE_STATUS_CATEGORY');
  assert(!previous||status.teamId===previous.teamId,422,'An existing workflow status cannot move to another team.','IMMUTABLE_STATUS_TEAM');
  if(status.type==='duplicate')assert(actor.system&&actor.hierarchySync,422,'Duplicate is a system-managed status and cannot be created or customized.','SYSTEM_WORKFLOW_STATUS');
}

export function validateWorkflowRemoval(repo:Repository,actor:Actor,status:RecordEntity){
  assert(status.type!=='duplicate',422,'Duplicate is a system-managed status and cannot be deleted.','SYSTEM_WORKFLOW_STATUS');
  if(NORMAL_WORKFLOW_CATEGORIES.has(status.type))assert(repo.all('statuses',actor.workspaceId).some(other=>other.id!==status.id&&other.teamId===status.teamId&&other.type===status.type),422,'Keep at least one status in each workflow category.','LAST_WORKFLOW_STATUS');
  assert(!repo.all('issues',actor.workspaceId).some(issue=>issue.statusId===status.id),422,'Status is in use','IN_USE');
}

/** Reserved definitions are created only by the duplicate operation, including their inherited ancestors. */
export function ensureDuplicateStatus(repo:Repository,actor:Actor,teamId:string):RecordEntity{
  const existing=repo.all('statuses',actor.workspaceId).find(status=>status.teamId===teamId&&status.type==='duplicate');if(existing)return existing;
  const team=repo.raw('teams',teamId)!;
  const parent=team.inheritStatuses&&team.parentId?ensureDuplicateStatus(repo,actor,team.parentId):null;
  return repo.create({...actor,system:true,hierarchySync:true,scopes:[...actor.scopes,'statuses:write']},'statuses',{teamId,name:'Duplicate',type:'duplicate',color:'#858699',position:99,...(parent?{inheritedStatusId:parent.id,inheritedFromTeamId:team.parentId}:{})});
}
