import type {Condition,FilterSpec} from './query';
const selectionOperators=new Set(['in','none','all','notAll','eq','is','equals','neq','isNot']);
/** Saving a view can wrap its filter in an empty group; expose the original choices when reopened. */
export function unwrapIssueFilter(filter:FilterSpec):FilterSpec {
 let current=filter;
 for(let depth=0;depth<32&&current.conditions.length===0&&current.groups?.length===1;depth++){
  const child=current.groups[0];
  if(!child||!Array.isArray(child.conditions))break;
  current=child;
 }
 return current;
}
export function selectedCondition(filter:FilterSpec,field:string){return filter.conditions.find(c=>c.field===field&&selectionOperators.has(c.operator));}
export function selectedValues(condition?:Condition):any[]{return condition?Array.isArray(condition.value)?condition.value:[condition.value]:[];}
function updateSelection(filter:FilterSpec,field:string,operator:string,values:unknown[]):FilterSpec {
 // Keep the chip in place while its value menu is open, including when other filters follow it.
 const index=filter.conditions.findIndex(c=>c.field===field&&selectionOperators.has(c.operator));
 const conditions=filter.conditions.filter(c=>!(c.field===field&&selectionOperators.has(c.operator)));
 if(values.length)conditions.splice(index<0?conditions.length:index,0,{field,operator,value:values});
 return {...filter,conditions};
}
export function toggleFilterSelection(filter:FilterSpec,field:string,id:unknown):FilterSpec {
 const previous=selectedCondition(filter,field),selected=selectedValues(previous);
 const labelField=field==='labelIds';
 const values=selected.includes(id)?selected.filter(value=>value!==id):labelField?(id===null?[null]:[...selected.filter(value=>value!==null),id]):[...selected,id];
 const operator=['none','neq','isNot'].includes(previous?.operator||'')?'none':previous?.operator==='notAll'?'notAll':previous?.operator==='all'||labelField&&!previous?'all':'in';
 return updateSelection(filter,field,operator,values);
}
export function toggleFilterSelections(filter:FilterSpec,field:string,ids:unknown[]):FilterSpec {
 const previous=selectedCondition(filter,field),selected=selectedValues(previous),remove=ids.every(id=>selected.includes(id));
 const values=remove?selected.filter(value=>!ids.includes(value)):[...selected,...ids.filter(id=>!selected.includes(id))];
 const operator=['none','neq','isNot'].includes(previous?.operator||'')?'none':previous?.operator==='notAll'?'notAll':previous?.operator==='all'?'all':'in';
 return updateSelection(filter,field,operator,values);
}
export const categoricalFilterFields=new Set(['effectiveCustomerIds','directCustomerIds','initiativeIds','linkSourceTypes','teamId','statusId','assigneeId','creatorId','priority','estimate','projectId','cycleId','milestoneId','subscribers','templateId','projectStatus','projectPriority','projectLeadId','recurringSeriesId','customerIds','customerOwnerIds','customerStatus','customerTier']);
export function selectionOperatorName(condition:Condition){return ['none','neq','isNot'].includes(condition.operator)?'is not':selectedValues(condition).length>1?'is any of':'is';}
