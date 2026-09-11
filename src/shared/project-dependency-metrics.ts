import type {Entity} from './types';
import {buildProgressHistory} from './progress-data';
export const projectDependencyFields=[['hasDependencies','Has dependencies'],['hasBlockingDependency','Has blocking dependency'],['hasBlockedByDependency','Has blocked by dependency'],['hasViolatedDependencies','Has violated dependencies']] as const;
type Metrics={hasDependencies:boolean;hasBlockingDependency:boolean;hasBlockedByDependency:boolean;hasViolatedDependencies:boolean};
export function usesProjectDependencyMetrics(value:unknown):boolean {
  if(Array.isArray(value))return value.some(usesProjectDependencyMetrics);
  if(value&&typeof value==='object')return Object.entries(value).some(([key,value])=>usesProjectDependencyMetrics(key)||usesProjectDependencyMetrics(value));
  return projectDependencyFields.some(([key])=>key===value);
}
export function buildProjectDependencyMetrics(data:{projects:Entity[];issues:Entity[];activities:Entity[];statuses:Entity[];teams:Entity[];workspaces?:Entity[]},now=Date.now()) {
  const projects=data.projects.filter(project=>!project.deletedAt&&!project.archivedAt),lookup=new Map(projects.map(project=>[project.id,project])),result=new Map<string,Metrics>(),forecasts=new Map<string,number>();
  for(const project of projects)result.set(project.id,{hasDependencies:false,hasBlockingDependency:false,hasBlockedByDependency:false,hasViolatedDependencies:false});
  for(const blocked of projects)for(const id of new Set<string>(blocked.dependencyIds||[])){
    const blocker=lookup.get(id);if(!blocker||id===blocked.id)continue;
    const incoming=result.get(blocked.id)!,outgoing=result.get(id)!;incoming.hasDependencies=outgoing.hasDependencies=true;incoming.hasBlockedByDependency=true;outgoing.hasBlockingDependency=true;
    let end=Date.parse(blocker.targetDate);
    if(!Number.isFinite(end)){if(!forecasts.has(id)){const activeWork=data.issues.some(issue=>issue.projectId===id&&!issue.deletedAt&&['started','completed'].includes(data.statuses.find(status=>status.id===issue.statusId)?.type));forecasts.set(id,buildProgressHistory({collection:activeWork&&!blocker.startedAt?{...blocker,startedAt:new Date(now).toISOString()}:blocker,kind:'project',...data,now}).prediction?.date??NaN);}end=forecasts.get(id)!;}
    const start=Date.parse(blocked.startDate||blocked.targetDate);
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)incoming.hasViolatedDependencies=outgoing.hasViolatedDependencies=true;
  }
  return result;
}
