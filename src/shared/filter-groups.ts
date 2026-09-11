export class InvalidFilterGroup extends Error {}
export function filterConditionCount(filter:any,depth=0):number{
 if(!filter||depth>32)return 0;
 return (Array.isArray(filter.conditions)?filter.conditions.length:0)+(Array.isArray(filter.groups)?filter.groups.reduce((sum:number,group:any)=>sum+filterConditionCount(group,depth+1),0):0);
}
/** Preserve nested boolean boundaries. Empty editor groups do not constrain results. */
export function expandFilterGroups(filter:any,depth=0):any{
 if(depth>32)throw new InvalidFilterGroup('Filter nesting is too deep');
 if(!filter||typeof filter!=='object')return filter;
 if(Array.isArray(filter))return filter.map(value=>expandFilterGroups(value,depth+1));
 if(filter.groups!==undefined){
  if(!Array.isArray(filter.conditions)||filter.match!==undefined&&!['all','any'].includes(filter.match))throw new InvalidFilterGroup('Invalid filter group');
  if(!Array.isArray(filter.groups)||filter.groups.length>100)throw new InvalidFilterGroup('Filter groups must be an array of at most 100 groups');
  const children:any[]=[];if(filter.conditions.length)children.push({conditions:filter.conditions,match:filter.match});
  for(const group of filter.groups){if(!group||typeof group!=='object'||!Array.isArray(group.conditions))throw new InvalidFilterGroup('Invalid filter group');const compiled=expandFilterGroups(group,depth+1);if(filterConditionCount(group))children.push(compiled)}
  return children.length?{[filter.match==='any'?'or':'and']:children}:{conditions:[],match:'all'};
 }
 return Object.fromEntries(Object.entries(filter).map(([key,value])=>[key,['and','or','not'].includes(key)?expandFilterGroups(value,depth+1):value]));
}
