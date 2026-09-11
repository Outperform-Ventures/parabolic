import type { Entity } from './types.ts';

export const INITIATIVE_STATUSES=[{value:'proposed',label:'Proposed'},{value:'planned',label:'Planned'},{value:'active',label:'Active'},{value:'completed',label:'Completed'},{value:'canceled',label:'Canceled'}];
export function initiativeParentIds(initiative:Pick<Entity,'id'> & Record<string,any>):string[]{return [...new Set<string>(Array.isArray(initiative.parentIds)?initiative.parentIds.filter((id:any)=>typeof id==='string'&&id):initiative.parentId?[initiative.parentId]:[])];}
const live=(entity:Entity)=>!entity.deletedAt&&!entity.archivedAt;
type Index={initiatives:Map<string,Entity>;children:Map<string,Entity[]>;projects:Map<string,Entity>;direct:Map<string,Set<string>>;order:Map<string,number>};
const cache=new WeakMap<Entity[],WeakMap<Entity[],Index>>();
function buildIndex(initiatives:Entity[],projects:Entity[]):Index{
  let byProjects=cache.get(initiatives);if(!byProjects){byProjects=new WeakMap();cache.set(initiatives,byProjects);}const stored=byProjects.get(projects);if(stored)return stored;
  const index:Index={initiatives:new Map(initiatives.filter(live).map(i=>[i.id,i])),children:new Map(),projects:new Map(projects.filter(live).map(p=>[p.id,p])),direct:new Map(),order:new Map(projects.map((p,i)=>[p.id,i]))};
  const add=(initiativeId:string,projectId:string)=>{if(!index.projects.has(projectId))return;const ids=index.direct.get(initiativeId)||new Set<string>();ids.add(projectId);index.direct.set(initiativeId,ids);};
  for(const item of index.initiatives.values()){for(const parentId of initiativeParentIds(item)){const children=index.children.get(parentId)||[];children.push(item);index.children.set(parentId,children);}for(const projectId of item.projectIds||[])add(item.id,projectId);}
  for(const project of index.projects.values())for(const id of new Set<string>([...(project.initiativeIds||[]),...(project.initiativeId?[project.initiativeId]:[])]))add(id,project.id);
  byProjects.set(projects,index);return index;
}
export function initiativeDescendantIds(initiatives:Entity[],id:string){const children=new Map<string,string[]>();for(const item of initiatives.filter(live))for(const parent of initiativeParentIds(item))children.set(parent,[...(children.get(parent)||[]),item.id]);const result=new Set<string>(),queue=[id];while(queue.length){for(const child of children.get(queue.pop()!)||[])if(child!==id&&!result.has(child)){result.add(child);queue.push(child);}}return result;}
export function initiativeProjectRollup(initiatives:Entity[],projects:Entity[],id:string,includeDescendants=true){
  const index=buildIndex(initiatives,projects),scope=new Set<string>([id]),queue=[id];if(includeDescendants)while(queue.length)for(const child of index.children.get(queue.pop()!)||[])if(!scope.has(child.id)){scope.add(child.id);queue.push(child.id);}
  const projectIds=new Set<string>();for(const initiativeId of scope)for(const projectId of index.direct.get(initiativeId)||[])projectIds.add(projectId);
  return {initiativeIds:[...scope],projects:[...projectIds].sort((a,b)=>(index.order.get(a)||0)-(index.order.get(b)||0)).map(projectId=>index.projects.get(projectId)!),directProjectIds:[...(index.direct.get(id)||[])],children:index.children.get(id)||[]};
}
