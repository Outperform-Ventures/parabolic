import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';

const categories=['backlog','planned','started','completed','canceled'];
const defaults=categories.map((id,sortOrder)=>({id,name:({backlog:'Backlog',planned:'Planned',started:'In progress',completed:'Completed',canceled:'Canceled'} as Record<string,string>)[id],type:id,color:'#858699',sortOrder}));
export function projectStatuses(repo:Repository,workspaceId:string):any[]{return repo.raw('workspaces',workspaceId)?.projectStatuses||defaults;}

export function validateProjectStatuses(repo:Repository,actor:Actor,workspace:RecordEntity){
  if(workspace.projectStatuses===undefined)return;const statuses=workspace.projectStatuses;assert(Array.isArray(statuses)&&statuses.length>=5&&statuses.length<=100,422,'Project statuses require 5–100 entries','INVALID_PROJECT_STATUS');const ids=new Set<string>(),names=new Set<string>();
  for(const status of statuses){assert(status&&typeof status==='object'&&!Array.isArray(status),422,'Invalid project status','INVALID_PROJECT_STATUS');assert(typeof status.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(status.id)&&!ids.has(status.id),422,'Project status IDs must be unique','INVALID_PROJECT_STATUS');ids.add(status.id);assert(typeof status.name==='string'&&status.name.trim()&&status.name.length<=100&&!names.has(status.name.trim().toLowerCase()),422,'Project status names must be unique and nonempty','INVALID_PROJECT_STATUS');names.add(status.name.trim().toLowerCase());assert(categories.includes(status.type),422,'Invalid project status category','INVALID_PROJECT_STATUS');assert(typeof status.color==='string'&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(status.color),422,'Project status color must be a hex color','INVALID_PROJECT_STATUS');assert(status.sortOrder==null||(typeof status.sortOrder==='number'&&Number.isFinite(status.sortOrder)),422,'Invalid project status order','INVALID_PROJECT_STATUS');}
  assert(categories.every(category=>statuses.some(status=>status.type===category)),422,'Each project status category needs at least one status','INVALID_PROJECT_STATUS');
  for(const project of repo.all('projects',actor.workspaceId,true))assert(!project.status||ids.has(project.status),422,'A project status is still in use','PROJECT_STATUS_IN_USE',{status:project.status,projectId:project.id});
}

export function applyProjectStatus(repo:Repository,actor:Actor,project:RecordEntity,previous?:RecordEntity){
  const statuses=projectStatuses(repo,actor.workspaceId);if(!previous&&(!project.status||(project.status==='planned'&&!statuses.some(status=>status.id==='planned'))))project.status=[...statuses].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).find(status=>status.type==='planned')!.id;
  const status=statuses.find(status=>status.id===project.status);assert(status,422,'Project status is not available in this workspace','INVALID_PROJECT_STATUS');if(['completed','canceled'].includes(status.type))project.completedAt??=(actor.now||new Date()).toISOString();else project.completedAt=null;
  if(status.type==='started')project.startedAt??=(actor.now||new Date()).toISOString();
}
