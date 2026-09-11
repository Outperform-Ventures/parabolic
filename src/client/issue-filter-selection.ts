import type {Condition,FilterSpec} from './query';
const selectionOperators=new Set(['in','none','all','notAll','eq','is','equals','neq','isNot']);
export function selectedCondition(filter:FilterSpec,field:string){return filter.conditions.find(c=>c.field===field&&selectionOperators.has(c.operator));}
export function selectedValues(condition?:Condition):any[]{return condition?Array.isArray(condition.value)?condition.value:[condition.value]:[];}
export function toggleFilterSelection(filter:FilterSpec,field:string,id:unknown):FilterSpec {
 const previous=selectedCondition(filter,field),selected=selectedValues(previous);
 const labelField=field==='labelIds';
 const values=selected.includes(id)?selected.filter(value=>value!==id):labelField?(id===null?[null]:[...selected.filter(value=>value!==null),id]):[...selected,id];
 const operator=['none','neq','isNot'].includes(previous?.operator||'')?'none':previous?.operator==='notAll'?'notAll':previous?.operator==='all'||labelField&&!previous?'all':'in';
 return {...filter,conditions:[...filter.conditions.filter(c=>!(c.field===field&&selectionOperators.has(c.operator))),...(values.length?[{field,operator,value:values}]:[])]};
}
export function toggleFilterSelections(filter:FilterSpec,field:string,ids:unknown[]):FilterSpec {
 const previous=selectedCondition(filter,field),selected=selectedValues(previous),remove=ids.every(id=>selected.includes(id));
 const values=remove?selected.filter(value=>!ids.includes(value)):[...selected,...ids.filter(id=>!selected.includes(id))];
 const operator=['none','neq','isNot'].includes(previous?.operator||'')?'none':previous?.operator==='notAll'?'notAll':previous?.operator==='all'?'all':'in';
 return {...filter,conditions:[...filter.conditions.filter(c=>!(c.field===field&&selectionOperators.has(c.operator))),...(values.length?[{field,operator,value:values}]:[])]};
}
export const categoricalFilterFields=new Set(['initiativeIds','linkSourceTypes','teamId','statusId','assigneeId','creatorId','priority','estimate','projectId','cycleId','milestoneId','subscribers','templateId','projectStatus','projectPriority','projectLeadId','recurringSeriesId','customerIds','customerOwnerIds','customerStatus','customerTier']);
export function selectionOperatorName(condition:Condition){return ['none','neq','isNot'].includes(condition.operator)?'is not':selectedValues(condition).length>1?'is any of':'is';}
