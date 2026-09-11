import type {Actor,Repository} from './repository';
const fields=new Set(['labelId','labelIds','projectLabelIds']);
function usesLabels(value:any):boolean{
 if(Array.isArray(value))return value.some(usesLabels);
 return !!value&&typeof value==='object'&&Object.entries(value).some(([key,item])=>fields.has(key)||key==='field'&&fields.has(item as string)||usesLabels(item));
}
/** Resolve group IDs using only definitions readable by this caller. Ordinary API label IDs retain exact identity. */
export function expandGroupFilter(repo:Repository,actor:Actor,filter:any):any{
 if(!usesLabels(filter))return filter;
 const groups=repo.all('labelGroups',actor.workspaceId).filter(group=>repo.canRead(actor,'labelGroups',group));
 if(!groups.length)return filter;
 const labels=repo.all('labels',actor.workspaceId).filter(label=>repo.canRead(actor,'labels',label));
 const children=new Map(groups.map(group=>[group.id,labels.filter(label=>(label.entityType||'issues')===(group.entityType||'issues')&&(label.teamId||null)===(group.teamId||null)&&(label.labelGroupId===group.id||!label.labelGroupId&&label.group===group.name)).map(label=>label.id)]));
 const selected=(value:any)=>Array.isArray(value)?value:[value];
 const hasGroup=(value:any)=>selected(value).some(id=>children.has(id));
 const referencesGroup=(value:any):boolean=>{
  if(Array.isArray(value))return value.some(referencesGroup);
  if(!value||typeof value!=='object')return false;
  if(fields.has(value.field)&&hasGroup(value.value))return true;
  return Object.entries(value).some(([key,item]:[string,any])=>fields.has(key)&&item&&typeof item==='object'&&!Array.isArray(item)&&Object.values(item).some(hasGroup)||referencesGroup(item));
 };
 if(!referencesGroup(filter))return filter;
 const one=(field:string,value:any)=>({conditions:[{field,operator:'in',value:children.get(value)??[value]}],match:'all'});
 const condition=(c:any):any=>{
  if(!fields.has(c.field)||!hasGroup(c.value)||!['eq','is','equals','contains','includes','in','notAll','all','neq','isNot','notContains','none'].includes(c.operator))return {conditions:[c],match:'all'};
  const choices=selected(c.value).map(id=>one(c.field,id));
  if(c.operator==='notAll')return {not:{and:choices}};
  if(c.operator==='all')return {and:choices};
  const positive={or:choices};return ['neq','isNot','notContains','none'].includes(c.operator)?{not:positive}:positive;
 };
 const walk=(value:any):any=>{
  if(Array.isArray(value))return {and:value.map(condition)};
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value.conditions))return value.conditions.length?{[value.match==='any'?'or':'and']:value.conditions.map(condition)}:value;
  return {and:Object.entries(value).map(([key,item]:[string,any])=>{
   if(key==='and'||key==='or')return {[key]:Array.isArray(item)?item.map(walk):item};
   if(key==='not')return {not:walk(item)};
   if(!fields.has(key)||!item||typeof item!=='object'||Array.isArray(item))return {[key]:item};
   return {and:Object.entries(item).map(([op,expected])=>{
    if(op==='contains'&&children.has(expected as string))return one(key,expected);
    if(op==='containsAll'&&Array.isArray(expected)&&hasGroup(expected))return {and:expected.map(id=>one(key,id))};
    return {[key]:{[op]:expected}};
   })};
  })};
 };
 return walk(filter);
}
