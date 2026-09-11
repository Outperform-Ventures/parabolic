import type {Entity,WorkspaceData} from '../../shared/types';
export type LabelUsage={count:number;lastApplied?:string;slaRules:Entity[];triageRules:Entity[]};
function references(value:any,result=new Set<string>()):Set<string>{
 if(Array.isArray(value)){for(const item of value)references(item,result);return result}
 if(!value||typeof value!=='object')return result;
 const add=(item:any)=>{if(Array.isArray(item))item.forEach(add);else if(typeof item==='string')result.add(item);else if(item&&typeof item==='object')Object.values(item).forEach(add)};
 if(['labelId','labelIds'].includes(value.field))add(value.value);
 for(const [key,item]of Object.entries(value)){if(['labelId','labelIds'].includes(key))add(item);else if(key!=='value')references(item,result)}return result;
}
export function buildLabelUsage(data:Pick<WorkspaceData,'issues'|'projects'|'initiatives'|'activities'|'slaPolicies'|'automations'>){
 const result=new Map<string,LabelUsage>(),get=(id:string)=>{let value=result.get(id);if(!value){value={count:0,slaRules:[],triageRules:[]};result.set(id,value)}return value};
 const work=new Set<string>();for(const [kind,rows]of [['issues',data.issues],['projects',data.projects],['initiatives',data.initiatives]] as const)for(const item of rows){work.add(kind+':'+item.id);if(item.deletedAt)continue;for(const id of new Set<string>(item.labelIds||[]))get(id).count++}
 for(const activity of data.activities){if(activity.deletedAt||!work.has(activity.entityKind+':'+activity.entityId))continue;const change=activity.changes?.labelIds;const before=new Set<string>(change?.from||[]),added=activity.action==='create'?activity.initialLabelIds:change?.to?.filter((id:string)=>!before.has(id));if(!Array.isArray(added)||!Number.isFinite(Date.parse(activity.createdAt)))continue;for(const id of added){const value=get(id);if(!value.lastApplied||Date.parse(value.lastApplied)<Date.parse(activity.createdAt))value.lastApplied=activity.createdAt}}
 for(const [key,rows]of [['slaRules',data.slaPolicies],['triageRules',data.automations.filter(rule=>rule.type==='routing')]] as const)for(const rule of rows){if(rule.deletedAt||rule.archivedAt)continue;const ids=references(rule.filter);if(key==='triageRules')references(rule.set||{labelIds:rule.labelIds},ids);for(const id of ids)get(id)[key].push(rule)}
 return result;
}
