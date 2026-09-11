import type {Entity} from './types';
import {projectLabelIndex} from './project-label-filter';

export const projectPropertyFields = [
  ['projectStatus','Project status'],
  ['projectPriority','Project priority'],
  ['projectLabelIds','Project labels'],
  ['projectLeadId','Project lead'],
  ['milestoneName','Milestone name'],
] as const;
const fields = new Set<string>([...projectPropertyFields.map(([field])=>field),'projectLabelCount','initiativeIds']);
const emptyRecords:Entity[]=[];
type PropertyIndex={projects:Map<string,Entity>;labelIds:Map<string,string[]>;milestones:Map<string,Entity>};
const indexes=new WeakMap<Entity[],WeakMap<Entity[],WeakMap<Entity[],PropertyIndex>>>();
export function usesProjectProperties(value:unknown):boolean {
  if(Array.isArray(value))return value.some(usesProjectProperties);
  if(!value||typeof value!=='object')return typeof value==='string'&&fields.has(value);
  return Object.entries(value).some(([key,item])=>fields.has(key)||usesProjectProperties(item));
}

/** Supply permission-scoped records. Missing projects must not become priority zero. */
export function projectPropertyIndex(projects:Entity[],labels:Entity[]=emptyRecords,milestones:Entity[]=emptyRecords):PropertyIndex {
  let byLabels=indexes.get(projects);if(!byLabels){byLabels=new WeakMap();indexes.set(projects,byLabels);}
  let byMilestones=byLabels.get(labels);if(!byMilestones){byMilestones=new WeakMap();byLabels.set(labels,byMilestones);}
  const cached=byMilestones.get(milestones);if(cached)return cached;
  const visibleProjects=new Map(projects.filter(p=>!p.deletedAt).map(p=>[p.id,p]));
  const labelIds=projectLabelIndex(projects,labels);
  const visibleMilestones=new Map(milestones.filter(m=>!m.deletedAt&&visibleProjects.has(m.projectId)).map(m=>[m.id,m]));
  const result={projects:visibleProjects,labelIds,milestones:visibleMilestones};byMilestones.set(milestones,result);return result;
}
export function withProjectProperties<T extends Entity>(issue:T,index:ReturnType<typeof projectPropertyIndex>) {
  const project=index.projects.get(issue.projectId),labels=project?index.labelIds.get(project.id)??[]:[];
  const milestone=index.milestones.get(issue.milestoneId);
  return {...issue,projectStatus:project?.status??null,projectPriority:project?(project.priority??0):null,
    initiativeIds:project?[...new Set([...(project.initiativeIds??[]),...(project.initiativeId?[project.initiativeId]:[])])]:[],projectLeadId:project?.leadId??null,projectLabelIds:labels,projectLabelCount:project?labels.length:null,
    milestoneName:milestone&&milestone.projectId===issue.projectId?milestone.name:null};
}
/** Null is a selectable "No labels" value, without changing ordinary empty-array semantics. */
export function projectLabelConditionEntity<T extends Entity>(entity:T,condition:{field:string;value?:unknown}):T {
  if(condition.field==='initiativeIds'&&!entity.initiativeIds?.length)return {...entity,initiativeIds:[null]};
  const selected=Array.isArray(condition.value)?condition.value:[condition.value];
  if(condition.field==='labelIds'&&selected.includes(null)&&!entity.labelIds?.length)return {...entity,labelIds:[null]};
  return condition.field==='projectLabelIds'&&selected.includes(null)&&entity.projectLabelCount===0
    ? {...entity,projectLabelIds:[null]} : entity;
}
