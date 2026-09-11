import type {Entity} from './types';
type GuestData={workspaceId?:string;memberships:Entity[];teams:Entity[];projects?:Entity[];issues?:Entity[];cycles?:Entity[]};
/** Guests never inherit public-team or ancestor access: membership must be explicit. */
export function guestCapabilities(data:GuestData,userId?:string){
 const guest=data.memberships.find(m=>!m.deletedAt&&!m.teamId&&m.userId===userId&&(!data.workspaceId||m.workspaceId===data.workspaceId))?.role==='guest';
 const explicitTeams=data.teams.filter(team=>!team.deletedAt&&(team.memberIds?.includes(userId)||data.memberships.some(m=>!m.deletedAt&&!m.pendingInvitation&&m.teamId===team.id&&m.userId===userId)));
 const teamIds=explicitTeams.filter(team=>!team.archivedAt&&!team.retiredAt).map(team=>team.id);
 const canTeam=(id?:string)=>!guest||!!id&&teamIds.includes(id);
 const canEntity=(entity?:Entity)=>{if(!guest)return true;if(!entity)return false;const parent=data.projects?.find(p=>p.id===entity.projectId)||data.issues?.find(p=>p.id===entity.issueId)||data.cycles?.find(p=>p.id===entity.cycleId);return [entity.teamId,...entity.teamIds??[],parent?.teamId,...parent?.teamIds??[]].filter(Boolean).some(canTeam);};
 const canRoute=(pathname:string)=>!guest||(!( /^\/team\/([^/]+)/.test(pathname)&&!explicitTeams.some(team=>team.id===/^\/team\/([^/]+)/.exec(pathname)?.[1]))&&!(/^\/(initiatives?|customers?|customer-request|asks)(\/|$)/.test(pathname)||['/views','/insights','/dashboards'].includes(pathname)||/^\/team\/[^/]+\/initiatives(?:\/|$)/.test(pathname)));
 return {guest,teamIds,canTeam,canEntity,canRoute,canCreate:!guest||teamIds.length>0};
}
