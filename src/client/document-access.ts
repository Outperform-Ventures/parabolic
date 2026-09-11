import type {Entity,WorkspaceData} from '../shared/types';

const retired=(team?:Entity)=>!!team&&(!!team.retiredAt||!!team.archivedAt||!!team.deletedAt);

/** Mirrors the parent paths enforced by server/team-lifecycle.ts for documents. */
export function documentReadOnlyReason(document:Entity,data:WorkspaceData):string|null {
  if(document.teamId&&retired(data.teams.find(team=>team.id===document.teamId)))return 'This team is retired. This document is read-only.';
  if(document.issueId){
    const issue=data.issues.find(item=>item.id===document.issueId),team=data.teams.find(item=>item.id===issue?.teamId);
    if(retired(team))return 'This team is retired. This document is read-only.';
  }
  if(document.projectId){
    const project=data.projects.find(item=>item.id===document.projectId),ids=[...new Set([...(project?.teamIds||[]),...(project?.teamId?[project.teamId]:[])])];
    if(ids.length&&ids.every(id=>retired(data.teams.find(team=>team.id===id))))return 'All teams associated with this document are retired. This document is read-only.';
  }
  return null;
}
