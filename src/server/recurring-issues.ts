import {cloneIssueRecords,issueTree} from './issue-operations.ts';
import {assert} from './errors.ts';
import {advanceOccurrence} from './calendar';
import {recurringDueCycle} from './cycles';
import type {Actor,RecordEntity,Repository} from './repository';
const dateOnly=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
export function validateRecurrence(recurrence:any){
 if(recurrence==null)return;
 assert(typeof recurrence==='object'&&!Array.isArray(recurrence),422,'Recurrence must be an object','VALIDATION_ERROR');
 assert(['daily','weekly','monthly','yearly'].includes(recurrence.frequency),422,'Recurrence frequency must be daily, weekly, monthly, or yearly','VALIDATION_ERROR');
 if(recurrence.interval!==undefined)assert(Number.isInteger(recurrence.interval)&&recurrence.interval>=1&&recurrence.interval<=365,422,'Recurrence interval must be an integer from 1 to 365','VALIDATION_ERROR');
 if(recurrence.dayOfMonth!==undefined)assert(Number.isInteger(recurrence.dayOfMonth)&&recurrence.dayOfMonth>=1&&recurrence.dayOfMonth<=31,422,'Recurrence day must be an integer from 1 to 31','VALIDATION_ERROR');
 if(recurrence.startDate!==undefined){const value=recurrence.startDate;assert(typeof value==='string'&&Number.isFinite(Date.parse(value))&&(!dateOnly(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value),422,'Recurrence start date must be valid','VALIDATION_ERROR');}
 if(recurrence.timeZone!==undefined){assert(typeof recurrence.timeZone==='string'&&recurrence.timeZone.length>0,422,'Invalid recurrence time zone','VALIDATION_ERROR');try{new Intl.DateTimeFormat('en-US',{timeZone:recurrence.timeZone});}catch{assert(false,422,'Invalid recurrence time zone','VALIDATION_ERROR');}}
}
/** Convert the calendar day after a due date to 00:01 in the team's timezone. */
export function recurringRunAt(dueDate:string,timeZone='UTC'){
 const day=new Date(dueDate+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);const target=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),0,1);
 const format=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});let candidate=target;
 for(let i=0;i<4;i++){const p=Object.fromEntries(format.formatToParts(new Date(candidate)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));const observed=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second),next=candidate+target-observed;if(next===candidate)break;candidate=next;}
 return new Date(candidate).toISOString();
}
export function prepareRecurringIssue(repo:Repository,actor:Actor,issue:RecordEntity,provided:Record<string,any>,previous?:RecordEntity){
 if(!actor.system)for(const field of ['nextRunAt','recurrenceDueDate','recurrenceSourceId'])assert(!Object.hasOwn(provided,field),422,field+' is managed by the recurring scheduler','INVALID_RECURRENCE_SCHEDULE');
 validateRecurrence(issue.recurrence);
 if(!issue.recurrence){if(previous?.recurrence){issue.nextRunAt=null;issue.recurrenceDueDate=null;}return;}
 // A recurring series owns its applied properties; future template edits/deletion cannot affect it.
 issue.templateId=null;

 const initializing=!previous?.recurrence;
 const dueChanged=Object.hasOwn(provided,'dueDate')&&issue.dueDate!==previous?.dueDate;
 const startChanged=Object.hasOwn(provided,'recurrence')&&issue.recurrence.startDate!==previous?.recurrence?.startDate;
 const explicitStart=startChanged&&dateOnly(issue.recurrence.startDate)?issue.recurrence.startDate:null;
 const first=dueChanged&&dateOnly(issue.dueDate)?issue.dueDate:explicitStart||
  (!initializing&&dateOnly(previous?.recurrenceDueDate)?previous.recurrenceDueDate:null)||
  (dateOnly(issue.dueDate)?issue.dueDate:dateOnly(issue.recurrence.startDate)?issue.recurrence.startDate:null);
 if(!first)return;
 const zone=issue.recurrence.timeZone||repo.raw('teams',issue.teamId)?.timezone||'UTC';
 assert(Number.isFinite(Date.parse(first+'T12:00:00Z'))&&new Date(first+'T12:00:00Z').toISOString().slice(0,10)===first,422,'Recurring due date must be a valid calendar date','VALIDATION_ERROR');
 try{new Intl.DateTimeFormat('en-US',{timeZone:zone});}catch{assert(false,422,'Invalid recurrence time zone','VALIDATION_ERROR');}
 if(initializing||dueChanged||explicitStart){issue.dueDate=first;issue.recurrence={...issue.recurrence,startDate:first};}
 const anchor=issue.recurrence.startDate||previous?.recurrence?.startDate||issue.dueDate||first;
 const schedule=(r:any)=>JSON.stringify([r?.frequency,r?.interval||1,r?.timeZone||zone,r?.startDate||anchor,r?.dayOfMonth||null]);
 const changed=schedule(issue.recurrence)!==schedule(previous?.recurrence);
 issue.recurrence={...issue.recurrence,timeZone:zone,startDate:anchor};
 if(initializing||dueChanged||explicitStart||changed){issue.recurrenceDueDate=first;issue.nextRunAt=recurringRunAt(first,zone);}

}
/** Native recurring schedules clamp each step from the current occurrence. */
export function advanceRecurringOccurrence(instant:Date,recurrence:any){return advanceOccurrence(instant,{...recurrence,startDate:instant.toISOString(),dayOfMonth:undefined})}
export function nextRecurringDueDate(issue:RecordEntity){
 if(!dateOnly(issue.recurrenceDueDate))return null;
 return advanceRecurringOccurrence(new Date(issue.recurrenceDueDate+'T12:00:00Z'),{...issue.recurrence,timeZone:'UTC'}).toISOString().slice(0,10);
}

/** Copy the current series issue tree without consulting its original template. */
export function createRecurringOccurrence(repo:Repository,actor:Actor,source:RecordEntity,nextDue:string|null){
 const statuses=repo.all('statuses',actor.workspaceId);
 return cloneIssueRecords(repo,actor,issueTree(repo,actor,source),(original,fields)=>{
  for(const key of ['recurrenceDueDate','recurrenceSourceId','snoozedUntil','slaRiskAt','slaRiskNotifiedAt','slaBreachNotifiedAt'])delete fields[key];
  const status=statuses.find(status=>status.teamId===original.teamId&&status.type==='unstarted');
  if(status)fields.statusId=status.id;
  if(original.id===source.id){fields.recurrenceSourceId=source.id;fields.parentId=source.parentId||null;if(nextDue){fields.dueDate=nextDue;fields.cycleId=recurringDueCycle(repo,{...original,dueDate:nextDue});}}
 }).issues[0];
}
