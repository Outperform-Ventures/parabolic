import { assert, HttpError } from './errors.ts';
import type { Actor, Repository } from './repository.ts';
import {pagination,cursorId} from './pagination.ts';

// The ordinary validator remains the fallback for filter shapes whose JavaScript
// semantics cannot be represented exactly by these indexed scalar comparisons.
export function exactFilter(filter:any,kind:string):boolean {
  if(!filter)return true;if(typeof filter!=='object'||Array.isArray(filter)||filter.conditions)return false;
  const stringFields=new Set(['id','teamId','projectId','cycleId','statusId','assigneeId','milestoneId','parentId','customerId','identifier','createdAt','updatedAt','dueDate','targetDate']);
  return Object.entries(filter).every(([field,value]:[string,any])=>{
    if(field==='and'||field==='or')return Array.isArray(value)&&value.length>0&&value.every(item=>exactFilter(item,kind));
    if(field==='not')return false;
    const numeric=kind==='issues'&&['priority','estimate','number'].includes(field);if(!numeric&&!stringFields.has(field))return false;
    const scalar=(v:any)=>numeric?typeof v==='number'&&Number.isFinite(v):typeof v==='string';
    if(value==null)return false;if(typeof value!=='object')return scalar(value);if(Array.isArray(value))return value.every(scalar);
    return Object.entries(value).every(([op,v]:[string,any])=>['eq','neq','gt','gte','lt','lte'].includes(op)?scalar(v):['in','nin'].includes(op)&&Array.isArray(v)&&v.every(scalar));
  });
}

export function canReadAllParents(repo:Repository,actor:Actor){
  if(actor.role==='guest'||actor.appId)return false;
  // Ancestor privacy is checked once for this workspace. If any excluded parent
  // exists, use the complete recursive permission evaluator for every candidate.
  const privateRows=repo.db.prepare(`SELECT kind,data FROM entities WHERE workspace_id=? AND kind IN ('teams','documents','views','dashboards') AND json_extract(data,'$.visibility') IN ('private','personal')
    UNION SELECT kind,data FROM entities WHERE workspace_id=? AND kind='teams' AND json_extract(data,'$.private')=1`).all(actor.workspaceId,actor.workspaceId) as {kind:string;data:string}[];
  return privateRows.every(row=>repo.canRead({...actor,scopes:[...actor.scopes,'read']},row.kind,JSON.parse(row.data)));
}

export function indexedList(repo:Repository,actor:Actor,kind:string,options:any,compiled:{sql:string;params:any[]},rawFilterSafe?:boolean) {
  if(['users','workspaces','activities'].includes(kind)||options.query||!exactFilter(options.filter,kind))return null;
  const [order,direction]=(options.orderBy||'updatedAt:desc').split(':');if(!['createdAt','updatedAt'].includes(order))return null;
  if(rawFilterSafe===false||rawFilterSafe===undefined&&!canReadAllParents(repo,actor))return null;
  // UUID ordering agrees with the existing locale comparison. Custom IDs retain
  // the original comparator so pagination never silently changes tie ordering.
  if(repo.db.prepare("SELECT 1 FROM entities INDEXED BY entity_custom_id WHERE workspace_id=? AND kind=? AND (length(id)<>36 OR id GLOB '*[^0-9a-f-]*') LIMIT 1").get(actor.workspaceId,kind))return null;
  const personal=['favorites','notifications','subscriptions'].includes(kind),where=`workspace_id=? AND kind=? ${options.includeDeleted?'':'AND deleted_at IS NULL'} ${personal?"AND json_extract(data,'$.userId')=?":''} AND (${compiled.sql})`;
  const parameters=[actor.workspaceId,kind,...(personal?[actor.userId]:[]),...compiled.params];
  const totalCount=Number((repo.db.prepare(`SELECT COUNT(*) AS count FROM entities WHERE ${where}`).get(...parameters) as any).count);
  const column=order==='createdAt'?'created_at':'updated_at',ascending=direction==='asc',{size,backward}=pagination(options);let boundSql='',boundParameters:any[]=[];
  const comparison=(before:boolean)=>`(${column} ${(ascending!==before)?'>':'<'} ? OR (${column}=? AND id${before?'<':'>'}?))`;
  if(options.after||options.before){const id=cursorId(actor,kind,options.after||options.before),row=repo.db.prepare(`SELECT id,${column} AS value FROM entities WHERE ${where} AND id=?`).get(...parameters,id) as any;assert(row,400,'Cursor record is no longer present; restart pagination','INVALID_CURSOR');boundSql=`AND ${comparison(!!options.before)}`;boundParameters=[row.value,row.value,row.id];}
  const rows=repo.db.prepare(`SELECT data FROM entities WHERE ${where} ${boundSql} ORDER BY ${column} ${ascending!==backward?'ASC':'DESC'},id ${backward?'DESC':'ASC'} LIMIT ?`).all(...parameters,...boundParameters,size+1) as {data:string}[];
  const nodes=rows.slice(0,size).map(row=>JSON.parse(row.data));if(backward)nodes.reverse();
  const exists=(entity:any,before:boolean)=>!!repo.db.prepare(`SELECT 1 FROM entities WHERE ${where} AND ${comparison(before)} LIMIT 1`).get(...parameters,entity[order],entity[order],entity.id);
  return {nodes,totalCount,pageInfo:{hasNextPage:nodes.length?exists(nodes.at(-1),false):backward?!!options.before:rows.length>0||!!options.before,hasPreviousPage:nodes.length?exists(nodes[0],true):backward?rows.length>0||!!options.after:!!options.after,startCursor:nodes.length?repo.cursor(actor,kind,nodes[0].id):null,endCursor:nodes.length?repo.cursor(actor,kind,nodes.at(-1).id):null}};
}
