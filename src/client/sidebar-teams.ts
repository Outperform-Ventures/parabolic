import type {Entity} from '../shared/types';
/** Public visibility does not imply that the user joined the team. */
export function joinedSidebarTeams(teams:Entity[],memberships:Entity[],userId:string|undefined){
 if(!userId)return [];
 const joined=new Set(memberships.filter(row=>!row.deletedAt&&row.userId===userId&&row.teamId).map(row=>row.teamId));
 return teams.filter(team=>!team.deletedAt&&!team.archivedAt&&(team.memberIds?.includes(userId)||team.ownerIds?.includes(userId)||(team.ownerId||team.creatorId)===userId||joined.has(team.id)));
}

export function orderSidebarTeams(teams:Entity[],order:string[]=[]){return [...teams].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length:ai)-(bi<0?order.length:bi);});}
