import type {Entity,WorkspaceData} from '../shared/types';
/** Label views resolve current metadata, including archived labels retained for history. */
export function labelViewRoute(route:string|undefined,data:Pick<WorkspaceData,'labels'|'labelGroups'>):{kind:'labels'|'labelGroups';entity:Entity|undefined}|null{
 const match=/^\/(label|label-group)\/([^/?#]+)(?:[/?#]|$)/.exec(route||'');if(!match)return null;
 let id:string;try{id=decodeURIComponent(match[2]);}catch{return null;}
 const kind=match[1]==='label'?'labels':'labelGroups';
 const source=data[kind].find(e=>e.id===id&&(e.entityType||'issues')==='issues');
 if(source&&!source.deletedAt)return {kind,entity:source};
 const other=kind==='labels'?'labelGroups':'labels';
 if(source?.deletedAt&&source.convertedTo===other)return {kind:other,entity:data[other].find(e=>e.id===id&&!e.deletedAt&&(e.entityType||'issues')==='issues')};
 return {kind,entity:undefined};
}
