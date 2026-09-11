import type {Entity,WorkspaceData} from '../shared/types';
export const isIssueLabelGroup=(field:string)=>field.startsWith('labelGroupId:');
export const issueLabelGroupField=(id:string)=>'labelGroupId:'+id;
export function issueLabelGroups(data:WorkspaceData,teamId?:string){return [...data.labelGroups,...data.labels.filter(l=>l.isGroup)].filter(g=>!g.deletedAt&&!g.archivedAt&&(g.entityType||'issues')==='issues'&&(!teamId||!g.teamId||g.teamId===teamId));}
export function issueLabelsInGroup(field:string,data:WorkspaceData){
 const id=field.slice(13),group=[...data.labelGroups,...data.labels.filter(l=>l.isGroup)].find(g=>g.id===id&&!g.deletedAt&&(g.entityType||'issues')==='issues');
 return group?data.labels.filter(l=>!l.deletedAt&&!l.isGroup&&(l.entityType||'issues')==='issues'&&(l.teamId||null)===(group.teamId||null)&&(l.labelGroupId===id||!l.labelGroupId&&l.group===group.name)):[];
}
