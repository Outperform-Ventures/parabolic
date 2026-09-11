import type {Entity} from '../../shared/types';
import type {FilterSpec} from '../query';
import type {InsightConfig} from './insight-data';

export function dashboardSource(widget:Record<string,any>,views:Entity[]){
 const view=widget.sourceViewId?views.find(view=>view.id===widget.sourceViewId&&!view.deletedAt&&!view.archivedAt):undefined;
 if(widget.sourceViewId&&!view)return null;
 const groups:FilterSpec[]=[widget.filters,view?.filters].filter(Boolean);
 if(view?.teamId)groups.push({match:'all',conditions:[{field:'teamId',operator:'eq',value:view.teamId}]});
 if(view?.projectId)groups.push({match:'all',conditions:[{field:'projectId',operator:'eq',value:view.projectId}]});
 return {...widget,...view?.insightConfig,filters:{match:'all',conditions:[],groups}} as InsightConfig;
}

export function dashboardIssueVisible(issue:Entity,teams:Entity[],scopeTeamId?:string,excludePrivate=false){
 if(scopeTeamId&&issue.teamId!==scopeTeamId)return false;
 if(!excludePrivate)return true;
 const team=teams.find(team=>team.id===issue.teamId&&!team.deletedAt);
 // An individually shared private issue can have its team redacted. Missing
 // team metadata must not turn it into public workspace dashboard data.
 return !!team&&!team.private&&!['private','restricted'].includes(team.visibility);
}
