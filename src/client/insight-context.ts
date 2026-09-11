import {resolveTimestampFilterValue} from '../shared/relative-timestamp-filter';
import {shiftCalendarDate} from '../shared/date-filter-range';
import {resolveRelativeDate,supportsDateOn} from '../shared/relative-date-filter';
import type {Condition,FilterSpec} from './query';

export type InsightContext={filter:FilterSpec;query:string;showCompleted:boolean;showSubIssues:boolean};
const operators=new Set(['eq','is','equals','neq','isNot','contains','includes','notContains','in','notAll','all','none','within','on','empty','isEmpty','notEmpty','before','lt','after','gt','gte','lte']);
const emptyOperators=new Set(['empty','isEmpty','notEmpty']);
const comparisonOperators=new Set(['before','lt','after','gt','gte','lte']);
const scalar=(value:unknown)=>value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=2000;
/** Shared links are untrusted input; reject the complete context if a condition is malformed. */
export function parseInsightContext(serialized:string|null):InsightContext|null {
  if(!serialized||serialized.length>65536)return null;
  try {
    const value=JSON.parse(serialized);
    if(!value||typeof value!=='object'||Array.isArray(value)||!value.filter||typeof value.filter!=='object'||Array.isArray(value.filter))return null;
    const filter=parseFilter(value.filter);if(!filter)return null;
    if(value.query!==undefined&&(typeof value.query!=='string'||value.query.length>1000))return null;
    for(const field of ['showCompleted','showSubIssues'])if(value[field]!==undefined&&typeof value[field]!=='boolean')return null;
    return {filter,query:value.query??'',showCompleted:value.showCompleted??true,showSubIssues:value.showSubIssues??true};
  }catch{return null;}
}

function parseFilter(filter:any,depth=0):FilterSpec|null {
  if(!filter||typeof filter!=='object'||Array.isArray(filter)||depth>16)return null;
    if(!Array.isArray(filter.conditions)||filter.conditions.length>100||(filter.match!==undefined&&!['all','any'].includes(filter.match)))return null;
    const conditions:Condition[]=[];
    for(const item of filter.conditions){
      if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.field!=='string'||item.field.length>100||!/^\w+(?:\.\w+){0,4}$/.test(item.field)||item.field.split('.').some((part:string)=>!/^[$A-Za-z_][$\w]*$/.test(part)||['__proto__','prototype','constructor'].includes(part))||!operators.has(item.operator))return null;
      let selected=item.value;
      if(emptyOperators.has(item.operator)){if(selected!==undefined&&!scalar(selected))return null;selected=null;}
      else if(['dueDate','startDate','targetDate','createdAt','updatedAt','completedAt','canceledAt','startedAt','archivedAt'].includes(item.field)&&Array.isArray(selected)&&['within','eq','is','equals','before','lt','after','gt'].includes(item.operator)){
        if(selected.length!==2||!selected.every((date:unknown)=>typeof date==='string'&&(shiftCalendarDate(date,0)||(item.field.endsWith('At')?resolveTimestampFilterValue(date):resolveRelativeDate(date)))))return null;
        if(selected.every((date:string)=>shiftCalendarDate(date,0))&&selected[0]>=selected[1])return null;
        selected=[...selected];
      }
      else if(item.operator==='on'){if(!supportsDateOn(item))return null;}
      else if(item.operator==='within')return null;
      else if(['in','notAll','all','none'].includes(item.operator)){if(!Array.isArray(selected)||selected.length>1000||!selected.every(scalar))return null;selected=[...selected];}
      else if(!scalar(selected)||(comparisonOperators.has(item.operator)&&typeof selected!=='number'&&typeof selected!=='string'))return null;
      conditions.push({field:item.field,operator:item.operator,value:selected});
    }
    const groups:FilterSpec[]=[];
    if(filter.groups!==undefined){
      if(!Array.isArray(filter.groups)||filter.groups.length>100)return null;
      for(const group of filter.groups){const parsed=parseFilter(group,depth+1);if(!parsed)return null;groups.push(parsed);}
    }
    return {conditions,match:filter.match??'all',...(filter.groups!==undefined?{groups}:{})};
}
