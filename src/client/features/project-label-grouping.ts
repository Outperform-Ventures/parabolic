import type {Entity} from '../../shared/types';
export {labelGroupColumn,columnLabelGroup} from '../../shared/project-display-groups';
export function projectLabelGroupValues(project:Entity,labels:Entity[],group:string|null){const available=new Set(labels.filter(label=>!label.deletedAt&&label.entityType==='projects'&&(group===null||label.group===group)).map(label=>label.id));const ids=[...new Set<string>((project.labelIds||[]).filter((id:string)=>available.has(id)))];return ids.length?ids:['none']}
export function moveProjectLabel(project:Entity,labels:Entity[],targetId:string|null,group:string|null,sourceId?:string){
 const byId=new Map(labels.filter(label=>!label.deletedAt&&label.entityType==='projects').map(label=>[label.id,label])),target=targetId?byId.get(targetId):undefined;
 if(targetId&&(!target||group!==null&&target.group!==group))throw Error('Label is not available in this group');
 if(target?.archivedAt&&!project.labelIds?.includes(targetId))throw Error('Archived labels cannot be newly applied');
 const kept=(project.labelIds||[]).filter((id:string)=>{const label=byId.get(id);if(!targetId)return group===null?false:label?.group!==group;return id!==sourceId&&id!==targetId&&(!target?.group||label?.group!==target.group)});
 return [...new Set<string>([...kept,...(targetId?[targetId]:[])])];
}
