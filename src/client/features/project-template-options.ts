import type {Entity,WorkspaceData} from '../../shared/types';
export function projectTemplateOptions(data:Pick<WorkspaceData,'teams'|'templates'>,teamId?:string){
 const scopes=new Set<string>();let team=data.teams.find(team=>team.id===teamId&&!team.deletedAt&&!team.archivedAt);
 while(team&&!scopes.has(team.id)){scopes.add(team.id);team=data.teams.find(item=>item.id===(team!.parentId||team!.parentTeamId)&&!item.deletedAt&&!item.archivedAt)}
 return data.templates.filter(template=>!template.deletedAt&&!template.archivedAt&&template.type==='project'&&(!template.teamId||scopes.has(template.teamId)));
}
