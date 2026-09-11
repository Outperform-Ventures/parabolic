import type {Actor,RecordEntity,Repository} from './repository';
import {templateApplies} from './templates';
import {teamAccess} from './team-hierarchy';

export function prepareIssueTeamMove(repo:Repository,actor:Actor,issue:RecordEntity,provided:Record<string,any>,previous:RecordEntity){
 if(issue.teamId===previous.teamId)return;
 const destination=repo.get({...actor,scopes:[...actor.scopes,'read']},'teams',issue.teamId);
 if(!Object.hasOwn(provided,'labelIds')){
   const labels=repo.all('labels',actor.workspaceId).filter(label=>!label.archivedAt&&(label.entityType||'issues')==='issues'&&templateApplies(repo,label,destination.id));
   const groups=new Set<string>();
   issue.labelIds=(previous.labelIds||[]).flatMap((id:string)=>{
     const old=repo.raw('labels',id),label=labels.find(label=>label.id===id)||labels.find(label=>old&&label.name===old.name&&(label.group||null)===(old.group||null));
     if(!label||label.group&&groups.has(label.group))return [];
     if(label.group)groups.add(label.group);return [label.id];
   });
 }
 if(issue.projectId&&!Object.hasOwn(provided,'projectId')){
   const project=repo.raw('projects',issue.projectId),teams=[...(project?.teamIds||[]),...(project?.teamId?[project.teamId]:[])];
   if(!project||!teams.includes(destination.id)){issue.projectId=null;issue.milestoneId=null;}
 }
 if(issue.assigneeId&&!Object.hasOwn(provided,'assigneeId')&&!teamAccess(repo,repo.actorForUser(issue.assigneeId,actor.workspaceId),destination))issue.assigneeId=null;
 if(issue.subscriberIds)issue.subscriberIds=issue.subscriberIds.filter((id:string)=>teamAccess(repo,repo.actorForUser(id,actor.workspaceId),destination));
}
