const fields=new Set(['dueDate','startDate','targetDate']);
const timestampFields=new Set(['createdAt','updatedAt','completedAt','canceledAt','startedAt','archivedAt']);
export function shiftCalendarDate(value:string,days:number):string|undefined{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
 const date=new Date(value+'T12:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)return;
 date.setUTCDate(date.getUTCDate()+days);if(date.getUTCFullYear()<1||date.getUTCFullYear()>9999)return;return date.toISOString().slice(0,10);
}
/** Stored intervals include their start and exclude their end. */
export function matchDateRange(raw:unknown,condition:{field:string;operator:string;value:any}):boolean|undefined{
 const timestamp=timestampFields.has(condition.field);
 if((!fields.has(condition.field)&&!timestamp)||!Array.isArray(condition.value))return;
 const [start,end]=condition.value;
 if(condition.value.length!==2||typeof start!=='string'||typeof end!=='string'||!(timestamp?Number.isFinite(Date.parse(start)):shiftCalendarDate(start,0))||!(timestamp?Number.isFinite(Date.parse(end)):shiftCalendarDate(end,0))||start>=end||typeof raw!=='string')return false;
 switch(condition.operator){
  case'within':case'eq':case'is':case'equals':return raw>=start&&raw<end;
  case'before':case'lt':return raw<start;
  case'after':case'gt':return raw>=end;
  default:return false;
 }
}
