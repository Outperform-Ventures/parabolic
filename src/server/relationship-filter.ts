import type {Actor,Repository,RecordEntity} from './repository';
import {HttpError} from './errors';

type Relation={target:string;fields?:string[];inverse?:string[];many?:boolean};
const singles:Record<string,[string,string]>={team:['teams','teamId'],project:['projects','projectId'],assignee:['users','assigneeId'],creator:['users','creatorId'],author:['users','authorId'],user:['users','userId'],lead:['users','leadId'],owner:['users','ownerId'],leadTeam:['teams','leadTeamId'],cycle:['cycles','cycleId'],milestone:['milestones','milestoneId'],initiative:['initiatives','initiativeId'],customer:['customers','customerId'],issue:['issues','issueId'],document:['documents','documentId'],state:['statuses','statusId']};
const arrays:Record<string,[string,string]>={labels:['labels','labelIds'],members:['users','memberIds'],teams:['teams','teamIds'],subscribers:['users','subscriberIds'],blockedBy:['issues','blockedByIds'],blocking:['issues','blockingIds'],related:['issues','relatedIds'],dependencies:['projects','dependencyIds']};
const names=new Set([...Object.keys(singles),...Object.keys(arrays),'parent','parents','children','issues','comments','documents','milestones','projects','initiatives']);
export function hasRelationshipFilter(value:any,depth=0):boolean{
 if(!value||typeof value!=='object'||depth>32)return false;
 if(Array.isArray(value))return value.some(item=>hasRelationshipFilter(item,depth+1));
 if(Array.isArray(value.conditions))return value.conditions.some((c:any)=>typeof c?.field==='string'&&c.field.includes('.')&&names.has(c.field.split('.')[0]))||hasRelationshipFilter(value.groups,depth+1);
 return Object.entries(value).some(([key,item])=>names.has(key.split('.')[0])&&item!==null&&typeof item==='object'||['and','or','not'].includes(key)&&hasRelationshipFilter(item,depth+1));
}
function relation(kind:string,name:string):Relation|undefined{
 if(Object.hasOwn(singles,name)){const[target,field]=singles[name];return{target,fields:[field]}}
 if(Object.hasOwn(arrays,name)){const[target,field]=arrays[name];return{target,fields:[field],many:true}}
 if(name==='parent')return{target:kind,fields:['parentId']};
 if(name==='parents'&&kind==='initiatives')return{target:kind,fields:['parentIds','parentId'],many:true};
 if(name==='children'&&['issues','initiatives','comments'].includes(kind))return{target:kind,inverse:kind==='initiatives'?['parentIds','parentId']:['parentId'],many:true};
 if(name==='issues'&&['teams','projects','cycles','milestones'].includes(kind))return{target:'issues',inverse:[{teams:'teamId',projects:'projectId',cycles:'cycleId',milestones:'milestoneId'}[kind]!],many:true};
 if(name==='comments'&&['issues','projects','documents','updates'].includes(kind))return{target:'comments',inverse:[{issues:'issueId',projects:'projectId',documents:'documentId',updates:'updateId'}[kind]!],many:true};
 if(name==='documents'&&['issues','projects','initiatives','teams','cycles'].includes(kind))return{target:'documents',inverse:[{issues:'issueId',projects:'projectId',initiatives:'initiativeId',teams:'teamId',cycles:'cycleId'}[kind]!],many:true};
 if(name==='milestones'&&kind==='projects')return{target:'milestones',inverse:['projectId'],many:true};
 if(name==='projects'&&kind==='initiatives')return{target:'projects',fields:['projectIds'],inverse:['initiativeIds','initiativeId'],many:true};
 if(name==='projects'&&kind==='teams')return{target:'projects',inverse:['teamIds','teamId'],many:true};
 if(name==='initiatives'&&kind==='projects')return{target:'initiatives',fields:['initiativeIds','initiativeId'],inverse:['projectIds'],many:true};
}
const condition=(field:string,ids:string[])=>({conditions:[{field,operator:'in',value:ids}],match:'all'});
const invert=(filter:any)=>({not:filter});
/** Compile relations to ID predicates against the caller's readable projection.
 * No inaccessible target property can affect positive, negative or universal matches.
 * Direct FK predicates also work for new/unsaved issue mutations in routing and SLA rules.
 */
export function expandRelationshipFilter(repo:Repository,actor:Actor,input:any,kind:string,prepare:(filter:any)=>any,evaluate:(entity:any,filter:any)=>boolean,validate:(filter:any)=>unknown):any{
 if(!hasRelationshipFilter(input))return input;
 const collections=new Map<string,RecordEntity[]>();let nodes=0;
 const readable=(kind:string)=>{let result=collections.get(kind);if(!result){const reader={...actor,recordCache:new Map(),permissionCache:new Map()};result=repo.all(kind,actor.workspaceId).filter(e=>repo.canRead(reader,kind,e)).map(e=>repo.present(reader,kind,e));collections.set(kind,result)}return result};
 const has=(r:Relation,targets:RecordEntity[])=>{const clauses:any[]=(r.fields??[]).map(field=>condition(field,targets.map(t=>t.id)));if(r.inverse){const parents=new Set<string>();for(const target of targets)for(const field of r.inverse){const values=Array.isArray(target[field])?target[field]:[target[field]];for(const id of values)if(typeof id==='string')parents.add(id)}clauses.push(condition('id',[...parents]))}return{or:clauses}};
 const walk=(raw:any,sourceKind:string,depth:number):any=>{
  if(depth>32||++nodes>1000)throw new HttpError(400,'Relationship filter is too complex','INVALID_FILTER');
  const value=prepare(raw);if(!value||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(item=>walk(item,sourceKind,depth+1));
  if(Array.isArray(value.conditions)&&!value.conditions.length)return value;
  if(Array.isArray(value.conditions))return{[value.match==='any'?'or':'and']:value.conditions.map((c:any)=>{
   const[field,...rest]=String(c.field??'').split('.');if(!rest.length||!names.has(field))return{conditions:[c],match:'all'};
   return walk({[field]:{conditions:[{...c,field:rest.join('.')}],match:'all'}},sourceKind,depth+1);
  })};
  return {and:Object.entries(value).map(([key,item]:[string,any])=>{
   if(key==='and'||key==='or'){if(!Array.isArray(item))throw new HttpError(400,key+' requires an array','INVALID_FILTER');return{[key]:item.map(child=>walk(child,sourceKind,depth+1))}}
   if(key==='not')return invert(walk(item,sourceKind,depth+1));
   const[name,...path]=key.split('.'),r=relation(sourceKind,name);
   if(!r||!item||typeof item!=='object'||Array.isArray(item))return{[key]:item};
   if(path.length)item={[path.join('.')]:item};
   const targets=readable(r.target),clauses:any[]=[];
   if(Object.hasOwn(item,'null')){if(typeof item.null!=='boolean')throw new HttpError(400,'Relation null requires a boolean','INVALID_FILTER');clauses.push(item.null?invert(has(r,targets)):has(r,targets))}
   const ordinary=Object.fromEntries(Object.entries(item).filter(([key])=>!['null','some','every','none'].includes(key)));
   const matching=(filter:any)=>{if(!filter||typeof filter!=='object'||Array.isArray(filter))throw new HttpError(400,'Relationship predicate must be an object','INVALID_FILTER');const compiled=walk(filter,r.target,depth+1);validate(compiled);return targets.filter(target=>evaluate(target,compiled))};
   if(Object.keys(ordinary).length||!Object.keys(item).length)clauses.push(has(r,matching(ordinary)));
   for(const op of ['some','every','none'])if(Object.hasOwn(item,op)){if(!r.many)throw new HttpError(400,op+' requires a collection relationship','INVALID_FILTER');const matched=matching(item[op]);if(op==='some')clauses.push(has(r,matched));else if(op==='none')clauses.push(invert(has(r,matched)));else{const ids=new Set(matched.map(t=>t.id));clauses.push(invert(has(r,targets.filter(t=>!ids.has(t.id)))))}}
   return{and:clauses};
  })};
 };
 return walk(input,kind,0);
}
