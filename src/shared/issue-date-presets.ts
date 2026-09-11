export const issueDateFields=[['dueDate','Due date'],['createdAt','Created date'],['updatedAt','Updated date'],['startedAt','Started date'],['completedAt','Completed date'],['autoClosedAt','Auto-closed date'],['triagedAt','Triaged date']] as const;
export function issueDatePresets(field:string){
 const historical=field!=='dueDate';
 const periods=historical?[['P1D','1 day'],['P3D','3 days'],['P1W','1 week'],['P1M','1 month'],['P3M','3 months'],['P6M','6 months'],['P1Y','1 year']]:[['P1D','1 day'],['P3D','3 days'],['P1W','1 week'],['P1M','1 month'],['P3M','3 months']];
 return [...(!historical?[{id:'overdue',name:'Overdue',condition:{field,operator:'lt',value:'P0D'}}]:[]),...periods.map(([duration,name])=>({id:duration,name:name+(historical?' ago':' from now'),condition:{field,operator:historical?'gte':'lte',value:(historical?'-':'')+duration}})),...(!historical?[{id:'none',name:'No due date',condition:{field,operator:'empty',value:''}}]:[])];
}
export function issueDatePresetName(field:string,operator:string,value:unknown){return issueDatePresets(field).find(p=>p.condition.operator===operator&&p.condition.value===value)?.name;}
