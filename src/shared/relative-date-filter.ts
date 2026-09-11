import {shiftCalendarDate} from './date-filter-range';
import {resolveRelativeTimestamp,resolveTimestampFilterValue} from './relative-timestamp-filter.ts';
/** A relative date stays in saved filters as a duration, resolved at evaluation time. */
export type RelativeDateClock={now?:Date;timeZone?:string};
const formatters=new Map<string,Intl.DateTimeFormat>();
function calendarParts(now:Date,timeZone:string){
 let formatter=formatters.get(timeZone);
 if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});formatters.set(timeZone,formatter)}
 const parts=Object.fromEntries(formatter.formatToParts(now).map(p=>[p.type,p.value]));return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day)};
}
/** Date-only calendar units; timestamp/time-of-day durations use a different domain. */
export function resolveRelativeDate(value:unknown,{now=new Date(),timeZone}:RelativeDateClock={}):string|undefined{
 if(typeof value!=='string')return;
 const match=/^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(value);
 if(!match||match.slice(2).every(part=>part===undefined))return;
 const units=match.slice(2).map(part=>Number(part||0));if(units.some(unit=>!Number.isSafeInteger(unit)||unit>10000))return;
 if(!Number.isFinite(now.getTime()))return;
 const sign=match[1]==='-'?-1:1,{year,month,day}=timeZone?calendarParts(now,timeZone):{year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate()};
 const target=new Date(0);target.setUTCHours(12,0,0,0);target.setUTCFullYear(year,month-1,1);
 target.setUTCMonth(target.getUTCMonth()+sign*(units[0]*12+units[1]));
 const end=new Date(target);end.setUTCMonth(end.getUTCMonth()+1,0);target.setUTCDate(Math.min(day,end.getUTCDate()));
 target.setUTCDate(target.getUTCDate()+sign*(units[2]*7+units[3]));
 const resolvedYear=target.getUTCFullYear();if(resolvedYear<1||resolvedYear>9999)return;
 return `${String(resolvedYear).padStart(4,'0')}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(target.getUTCDate()).padStart(2,'0')}`;
}

const calendarFields=new Set(['dueDate','startDate','targetDate']);
const timestampFields=new Set(['accumulatedStateUpdatedAt','createdAt','updatedAt','completedAt','canceledAt','startedAt','archivedAt','autoClosedAt','triagedAt']);
const resolver=(field:string)=>calendarFields.has(field)?resolveRelativeDate:timestampFields.has(field)?resolveTimestampFilterValue:undefined;
/** Detect only valid timestamp durations, never unrelated strings or date-only fields. */
export function hasRelativeTimestampFilter(filter:any,depth=0):boolean{
 if(!filter||typeof filter!=='object'||depth>64)return false;
 if(Array.isArray(filter))return filter.some(value=>hasRelativeTimestampFilter(value,depth+1));
 const valid=(value:unknown):boolean=>Array.isArray(value)?value.some(valid):resolveRelativeTimestamp(value,{now:new Date('2026-01-01T00:00:00Z'),timeZone:'UTC'})!==undefined;
 if(timestampFields.has(filter.field)&&valid(filter.value))return true;
 return Object.entries(filter).some(([key,value])=>timestampFields.has(key)&&value&&typeof value==='object'?Object.values(value).some(valid):hasRelativeTimestampFilter(value,depth+1));
}
export function supportsDateOn(condition:{field:string;value?:unknown}):boolean{return !!resolver(condition.field)&&typeof condition.value==='string'&&!!shiftCalendarDate(condition.value,1)}
export function resolveDateCondition<T extends {field:string;operator?:string;value?:unknown}>(condition:T,clock:RelativeDateClock={}):T{
 const resolve=resolver(condition.field);if(!resolve)return condition;
 clock={...clock,now:clock.now??new Date()};
 if(condition.operator==='on'&&supportsDateOn(condition)){const start=condition.value as string,end=shiftCalendarDate(start,1)!;return {...condition,operator:'within',value:[resolve(start,clock)??start,resolve(end,clock)??end]}}
 if(Array.isArray(condition.value))return {...condition,value:condition.value.map(value=>resolve(value,clock)??value)};
 const value=resolve(condition.value,clock);return value===undefined?condition:{...condition,value};
}
/** Resolve once per query, retaining the original saved filter and its relative intent. */
export function resolveCalendarFilter(filter:any,clock:RelativeDateClock={}):any{
 const fixed={...clock,now:clock.now??new Date()};
 const walk=(value:any):any=>{
  if(Array.isArray(value))return value.map(item=>item&&typeof item==='object'&&'field'in item?resolveDateCondition(item,fixed):walk(item));
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value.conditions))return {...value,conditions:value.conditions.map((c:any)=>resolveDateCondition(c,fixed)),...(Array.isArray(value.groups)?{groups:value.groups.map(walk)}:{})};
  return Object.fromEntries(Object.entries(value).map(([key,item]:[string,any])=>{
   if(['and','or','not'].includes(key))return [key,walk(item)];
   if(resolver(key)&&item&&typeof item==='object'&&!Array.isArray(item))return [key,Object.fromEntries(Object.entries(item).map(([op,expected])=>[op,Array.isArray(expected)?expected.map(value=>resolver(key)!(value,fixed)??value):resolver(key)!(expected,fixed)??expected]))];
   return [key,item];
  }));
 };
 return walk(filter);
}
