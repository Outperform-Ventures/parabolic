import type { Entity, WorkspaceData } from '../shared/types';

export const workflowCategories = ['triage','backlog','unstarted','started','completed','canceled','duplicate'] as const;
export const workflowCategoryName = (category:string) => ({triage:'Triage',backlog:'Backlog',unstarted:'Unstarted',started:'Started',completed:'Completed',canceled:'Canceled',duplicate:'Duplicate'}[category] || category);
export function orderedWorkflowStatuses(data:WorkspaceData,teamId?:string){
  return data.statuses.filter(status=>status.teamId===teamId&&!status.deletedAt&&!status.archivedAt).sort((a,b)=>workflowCategories.indexOf(a.type)-workflowCategories.indexOf(b.type)||(a.position||0)-(b.position||0)||a.id.localeCompare(b.id));
}
export function workflowDefaultStatus(data:WorkspaceData,teamId?:string):Entity|undefined{
  const team=data.teams.find(team=>team.id===teamId),statuses=orderedWorkflowStatuses(data,teamId);
  return statuses.find(status=>status.id===team?.defaultStatusId&&['backlog','unstarted'].includes(status.type)) || statuses.find(status=>status.type==='backlog') || statuses.find(status=>status.type==='unstarted');
}
export function isWorkflowTeamMember(data:WorkspaceData,teamId?:string,userId?:string){
  const team=data.teams.find(team=>team.id===teamId);
  return !!userId&&!!team&&(team.memberIds?.includes(userId)||(Array.isArray(team.ownerIds)?team.ownerIds.includes(userId):(team.ownerId||team.creatorId)===userId)||data.memberships.some(member=>!member.deletedAt&&member.teamId===teamId&&member.userId===userId));
}
export function initialWorkflowStatus(data:WorkspaceData,teamId?:string,userId?:string){
  const team=data.teams.find(team=>team.id===teamId);
  return (team?.triageEnabled!==false&&!isWorkflowTeamMember(data,teamId,userId)?orderedWorkflowStatuses(data,teamId).find(status=>status.type==='triage'):undefined)||workflowDefaultStatus(data,teamId);
}
