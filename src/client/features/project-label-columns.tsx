import React from 'react';
import type {Entity} from '../../shared/types';
import {FeaturePropertyPicker} from './property-picker';
import {Badge} from '../components/ui';
import {useActions} from './shared';
export {labelGroupColumn,columnLabelGroup} from './project-label-grouping';
export function projectLabelGroups(labels:Entity[],groups:Entity[]=[] ){return [...new Set<string>([...groups.filter(g=>!g.deletedAt&&g.entityType==='projects').map(g=>g.name),...labels.filter(label=>!label.deletedAt&&label.entityType==='projects'&&label.group).map(label=>label.group)])].sort((a,b)=>a.localeCompare(b))}
export function projectGroupLabel(project:Entity,group:string,labels:Entity[]){return labels.find(label=>!label.deletedAt&&label.entityType==='projects'&&label.group===group&&project.labelIds?.includes(label.id))}
export function ProjectLabelGroupCell({project,group}:{project:Entity;group:string}){
 const {data,update,act}=useActions(),selected=projectGroupLabel(project,group,data.labels),labels=data.labels.filter(label=>!label.deletedAt&&label.entityType==='projects'&&label.group===group);
 return <FeaturePropertyPicker label={group} triggerLabel={'Change '+group+' label'} values={[selected?.id||'']} options={[{value:'',label:'No '+group},...labels.filter(label=>!label.archivedAt||label.id===selected?.id).map(label=>({value:label.id,label:label.name,disabled:!!label.archivedAt}))]} triggerContent={selected?<Badge color={selected.color} description={selected.description}>{selected.name}</Badge>:<span className="muted">No {group}</span>} onChange={values=>{const groupIds=new Set(labels.map(label=>label.id));return act(()=>update('projects',project.id,{labelIds:[...(project.labelIds||[]).filter((id:string)=>!groupIds.has(id)),...values.filter(Boolean)]}))}}/>;
}
