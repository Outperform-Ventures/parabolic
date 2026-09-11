/** Resolve the viewer-relative choice at evaluation time, keeping saved views portable. */
export const CURRENT_USER_FILTER = '@current-user';
const resolved=new WeakMap<object,Map<string|undefined,any>>();
const people = new Set(['assigneeId','creatorId','subscribers','subscriberIds','customerOwnerIds','projectLeadId']);
export function resolveCurrentUserFilter(filter:any,userId?:string):any {
 if(!filter||typeof filter!=='object')return filter;
 const cached=resolved.get(filter);if(cached?.has(userId))return cached.get(userId);
 const remember=(result:any)=>{const map=cached||new Map();map.set(userId,result);resolved.set(filter,map);return result;};
 const values=(value:any):any=>Array.isArray(value)?value.map(values):value===CURRENT_USER_FILTER?(userId??'@unresolved-current-user'):value;
 if(Array.isArray(filter))return remember(filter.map(item=>resolveCurrentUserFilter(item,userId)));
 if(typeof filter.field==='string'&&people.has(filter.field))return remember({...filter,value:values(filter.value)});
 return remember(Object.fromEntries(Object.entries(filter).map(([key,value])=>[key,people.has(key)&&value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([op,v])=>[op,values(v)])):people.has(key)?values(value):resolveCurrentUserFilter(value,userId)])));
}
