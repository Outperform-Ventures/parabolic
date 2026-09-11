import {templateApplies} from './templates';
import {assert} from './errors';
import type {Actor,Repository,RecordEntity} from './repository';

function replaceReferences(value:any,source:string,target:string,group:Set<string>,filter=false):any{
 if(Array.isArray(value))return value.map(item=>replaceReferences(item,source,target,group,filter));
 if(!value||typeof value!=='object')return value;
 const result:any={};
 const condition=['labelIds','labelId','projectLabelIds'].includes(value.field);
 const replace=(item:any):any=>Array.isArray(item)?[...new Set(item.map(replace))]:item===source?target:item;
 for(const [key,item] of Object.entries(value)){
  if(key==='history'){result[key]=item;continue}
  if(['labelIds','projectLabelIds'].includes(key)&&Array.isArray(item)){
   const changed=item.includes(source),ids=replace(item);result[key]=changed&&key==='labelIds'&&!filter&&group.size?ids.filter((id:string)=>id===target||!group.has(id)):ids;
  }else if(key==='labelId'||condition&&key==='value')result[key]=replace(item);
  else if(['labelIds','projectLabelIds'].includes(key)){const expression=(part:any):any=>Array.isArray(part)?part.map(expression):part&&typeof part==='object'?Object.fromEntries(Object.entries(part).map(([key,value])=>[key,expression(value)])):part===source?target:part;result[key]=expression(item);}
  else result[key]=replaceReferences(item,source,target,group,filter||['filter','filters','conditions','labelIds','projectLabelIds'].includes(key));
 }
 return result;
}
export function mergeLabel(repo:Repository,actor:Actor,source:RecordEntity,targetId:unknown){
 assert(typeof targetId==='string'&&targetId!==source.id,422,'Choose another label to merge into','INVALID_LABEL_MERGE');
 const target=repo.get(actor,'labels',targetId);repo.access(actor,'labels',target,true);
 assert(!target.archivedAt,422,'Choose an active destination label','INVALID_LABEL_MERGE');
 assert((source.entityType||'issues')===(target.entityType||'issues'),422,'Issue and project labels cannot be merged together','INVALID_LABEL_MERGE');
 assert(!target.teamId||(!!source.teamId&&templateApplies(repo,target,source.teamId)),422,'The kept label must be available in the source label scope','INVALID_LABEL_MERGE');
 const group=new Set<string>(target.group?repo.all('labels',actor.workspaceId).filter(label=>label.group===target.group&&(label.entityType||'issues')===(target.entityType||'issues')).map(label=>label.id):[]);
 const kinds=['issues','projects','templates','views','dashboards','automations','slaPolicies','asksForms'];
 for(const kind of kinds)for(const row of repo.db.prepare('SELECT data FROM entities WHERE workspace_id=? AND kind=? AND instr(data,?)>0').all(actor.workspaceId,kind,source.id) as {data:string}[]){
  const before=JSON.parse(row.data),changed=replaceReferences(before,source.id,target.id,group);
  if(JSON.stringify(before)===JSON.stringify(changed))continue;
  const after={...changed,version:before.version+1,updatedAt:(actor.now||new Date()).toISOString()};repo.save(kind,after,'update',actor);repo.activity(actor,kind,after,'update',before);
 }
 const kept={...target,mergedLabelIds:[...new Set([...(target.mergedLabelIds||[]),source.id,...(source.mergedLabelIds||[])])],version:target.version+1,updatedAt:(actor.now||new Date()).toISOString()};repo.save('labels',kept,'update',actor);repo.activity(actor,'labels',kept,'update',target);
 return repo.remove(actor,'labels',source.id);
}
