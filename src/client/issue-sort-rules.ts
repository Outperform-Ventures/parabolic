import type {Entity} from '../shared/types';
import {sortEntities} from './query';
export type IssueSortRule={field:string;direction:'asc'|'desc'};
export const issueSortFields=[['sortOrder','Manual'],['priority','Priority'],['startDate','Start date'],['dueDate','Due date'],['duration','Duration'],['estimate','Estimate'],['timeEstimate','Time estimate'],['timeLogged','Time logged'],['title','Title'],['taskType','Task type'],['statusId','Status'],['assigneeId','Assignee'],['projectId','Project'],['teamId','Team'],['createdAt','Created'],['updatedAt','Updated'],['completedAt','Completed'],['linkCount','Link count'],['customerCount','Customer count'],['customerRevenue','Customer revenue']] as const;
export function availableIssueSortFields(issues:Entity[]):[string,string][]{
 const custom=new Map<string,string>();
 for(const issue of issues)for(const [key,value] of Object.entries(issue.customFields||{}))custom.set('customFields.'+key,(value&&typeof value==='object'&&'name' in value?String(value.name):key));
 return [...issueSortFields.map(([key,name]):[string,string]=>[key,name]),...Array.from(custom)];
}
const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function sortIssueView(items:Entity[],field:string,direction:'asc'|'desc',extra:IssueSortRule[]|undefined,records:{statuses:Entity[];users:Entity[];projects:Entity[];teams:Entity[]}){
 if(!extra?.length&&['sortOrder','priority','title','statusOrder','createdAt','updatedAt','dueDate'].includes(field))return sortEntities(items,field,direction);
 return sortIssuesByRules(items,[{field,direction},...(extra||[])],records);
}
export function sortIssuesByRules(items:Entity[],rules:IssueSortRule[],records:{statuses:Entity[];users:Entity[];projects:Entity[];teams:Entity[]}):Entity[]{
 if(!rules.length)return [...items];
 const resolve=(issue:Entity,field:string):any=>{
  if(field.startsWith('customFields.')){const value=issue.customFields?.[field.slice(13)];return value&&typeof value==='object'&&!Array.isArray(value)?value.value:value;}
  if(field==='duration'){if(issue.duration!=null)return issue.duration;return issue.startDate&&issue.dueDate?Date.parse(issue.dueDate)-Date.parse(issue.startDate):undefined;}
  if(field==='timeLogged')return issue.timeLogged??issue.timeEntries?.reduce((sum:number,e:any)=>sum+(Number(e.duration)||0),0);
  if(field==='statusId')return records.statuses.find(s=>s.id===issue.statusId)?.position??['started','unstarted','backlog','triage','completed','canceled'].indexOf(records.statuses.find(s=>s.id===issue.statusId)?.type);
  if(['assigneeId','projectId','teamId'].includes(field)){const list=field==='assigneeId'?records.users:field==='projectId'?records.projects:records.teams;return list.find(e=>e.id===(issue[field]??(field==='assigneeId'?issue.assigneeIds?.[0]:undefined)))?.name;}
  if(field==='linkCount')return issue.links?.length??0;
  return issue[field];
 };
 return [...items].sort((a,b)=>{
  for(const rule of rules){
   if(rule.field==='assigneeId'){const count=(issue:Entity)=>issue.assigneeIds?.length||(issue.assigneeId?1:0);const difference=count(b)-count(a);if(difference)return difference;}
   const left=resolve(a,rule.field),right=resolve(b,rule.field);
   const empty=(v:any)=>v==null||v===''||(rule.field==='priority'&&v===0);
   if(empty(left)||empty(right)){const result=Number(empty(left))-Number(empty(right));if(result)return result;continue;}
   const result=typeof left==='number'&&typeof right==='number'?left-right:typeof left==='boolean'&&typeof right==='boolean'?Number(left)-Number(right):collator.compare(String(left),String(right));
   if(result)return rule.direction==='desc'?-result:result;
  }
  return 0;
 });
}
