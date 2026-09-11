import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';
import { initiativeParentIds, INITIATIVE_STATUSES } from '../shared/initiatives.ts';

export function normalizeInitiative(entity:RecordEntity,provided:Record<string,any>,previous?:RecordEntity){
  if(Object.hasOwn(provided,'parentIds')){assert(Array.isArray(provided.parentIds)&&provided.parentIds.length<=100&&provided.parentIds.every((id:any)=>typeof id==='string'&&id),422,'Parent initiatives must be an array of IDs','INVALID_INITIATIVE');entity.parentIds=[...new Set(provided.parentIds)];}
  else if(Object.hasOwn(provided,'parentId'))entity.parentIds=provided.parentId?[provided.parentId]:[];
  else entity.parentIds=initiativeParentIds(entity);
  if(Object.hasOwn(provided,'parentPositions')){
    assert(provided.parentPositions&&typeof provided.parentPositions==='object'&&!Array.isArray(provided.parentPositions)&&Object.keys(provided.parentPositions).length<=100,422,'Parent positions must be a map of parent IDs to numbers','INVALID_INITIATIVE_POSITION');
    assert(Object.keys(provided.parentPositions).every(id=>entity.parentIds.includes(id)),422,'Positions must refer to current parent initiatives','INVALID_INITIATIVE_POSITION');
    entity.parentPositions={...(previous?.parentPositions||{}),...provided.parentPositions};
  }
  if(entity.parentPositions)entity.parentPositions=Object.fromEntries(Object.entries(entity.parentPositions).filter(([id])=>entity.parentIds.includes(id)));
  entity.parentId=entity.parentIds[0]||null;entity.priority??=0;entity.status??='planned';const alias:Record<string,string>={backlog:'proposed',started:'active','in progress':'active',in_progress:'active',paused:'planned'};entity.status=alias[String(entity.status).toLowerCase()]||String(entity.status).toLowerCase();if(Object.hasOwn(provided,'leadTeamId'))entity.teamId=provided.leadTeamId||null;entity.leadTeamId??=entity.teamId||null;
}
export function validateInitiative(repo:Repository,actor:Actor,entity:RecordEntity,previous?:RecordEntity){
  assert(INITIATIVE_STATUSES.some(status=>status.value===entity.status),422,'Invalid initiative status','INVALID_INITIATIVE');assert(Number.isInteger(entity.priority)&&entity.priority>=0&&entity.priority<=4,422,'Initiative priority must be between 0 and 4','INVALID_INITIATIVE');
  const validPosition=(value:any)=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e15;
  assert(entity.position==null||validPosition(entity.position),422,'Initiative position must be a finite number within ±1e15','INVALID_INITIATIVE_POSITION');
  for(const value of Object.values(entity.parentPositions||{}))assert(validPosition(value),422,'Parent position must be a finite number within ±1e15','INVALID_INITIATIVE_POSITION');
  const parents=initiativeParentIds(entity);for(const id of parents){const parent=repo.raw('initiatives',id);assert(parent&&repo.canRead({...actor,scopes:[...actor.scopes,'read']},'initiatives',parent),422,'Parent initiative is not accessible','INVALID_REFERENCE');assert(id!==entity.id,422,'Initiative cannot be its own parent','CYCLIC_RELATION');}
  if(previous&&JSON.stringify(initiativeParentIds(previous))===JSON.stringify(parents))return;
  const graph=new Map(repo.all('initiatives',actor.workspaceId).map(item=>[item.id,item]));graph.set(entity.id,entity);const depths=new Map<string,number>();
  const visit=(id:string,path:Set<string>):number=>{assert(!path.has(id),422,'Initiative parents would create a cycle','CYCLIC_RELATION');if(depths.has(id))return depths.get(id)!;assert(path.size<5,422,'Initiatives support at most five hierarchy levels','INITIATIVE_DEPTH');const current=graph.get(id);if(!current)return 0;const next=new Set(path);next.add(id);const parentDepths=initiativeParentIds(current).map(parent=>visit(parent,next));const depth=1+Math.max(0,...parentDepths);assert(depth<=5,422,'Initiatives support at most five hierarchy levels','INITIATIVE_DEPTH');depths.set(id,depth);return depth;};
  for(const id of graph.keys())visit(id,new Set());
}
