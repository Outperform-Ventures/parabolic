import {decodeHTML} from 'entities';
import type {Entity} from './types';
export const relationFilters=[
 ['isDuplicateIssue','Duplicates'],['isParentIssue','Parent issues'],['isBlockedIssue','Blocked issues'],['isBlockingIssue','Blocking issues'],['isRecurringIssue','Recurring issues'],['hasIssueRelations','Issues with relations'],['isSubIssue','Sub-issues'],
] as const;
const fields=new Set(['linkSourceTypes','accumulatedStateUpdatedAt','searchableContent','recurringSeriesId',...relationFilters.map(([key])=>key)]);
const seriesRecords=new WeakMap<Entity[],Map<string,Entity>>();
export function issueRecurringSeriesId(issue:Entity,issues?:Entity[]):string|null {
 if(!issue.recurrence&&!issue.recurrenceSourceId)return null;
 let records=issues?seriesRecords.get(issues):undefined;
 if(issues&&!records){records=new Map(issues.filter(i=>!i.deletedAt).map(i=>[i.id,i]));seriesRecords.set(issues,records);}
 let current=issue;const seen=new Set<string>();
 while(current.recurrenceSourceId&&!seen.has(current.id)){
  seen.add(current.id);const source=records?.get(current.recurrenceSourceId);
  if(!source)break;current=source;
 }
 return current.id;
}
export function usesIssueQuickFilter(value:any):boolean {
 if(!value||typeof value!=='object')return false;
 if(Array.isArray(value))return value.some(usesIssueQuickFilter);
 return fields.has(value.field)||Object.entries(value).some(([key,item])=>fields.has(key)||usesIssueQuickFilter(item));
}
const parentsCache=new WeakMap<Entity[],Set<string>>();
function parents(issues:Entity[]){let result=parentsCache.get(issues);if(!result){result=new Set(issues.filter(i=>!i.deletedAt&&i.parentId).map(i=>i.parentId));parentsCache.set(issues,result)}return result;}
function text(value:unknown):string {
 if(typeof value==='string')return decodeHTML(value.replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|li|h[1-6]|blockquote|pre)>/gi,' ').replace(/<[^>]*>/g,''));
 if(Array.isArray(value))return value.map(text).join(' ');
 if(value&&typeof value==='object'){const v=value as any;return [typeof v.text==='string'?v.text:'',text(v.content)].join(' ')}
 return '';
}
/** Link-source filtering uses recorded attachment metadata; ordinary URLs remain web links. */
export function issueLinkSources(issue:Entity):string[]{
 return [...new Set<string>((issue.links??[]).filter((link:any)=>!link.deletedAt).map((link:any)=>String(link.sourceType||link.source||'url')))];
}
/** Derived only from the caller's readable issue projection, never private targets. */
export function withIssueQuickFilter<T extends Entity>(issue:T,issues?:Entity[]):T {
 const relations=issue.relations??[],blocked=!!issue.blockedByIds?.length||relations.some((r:any)=>['blocked_by','blockedBy'].includes(r.type)),blocking=!!issue.blockingIds?.length||relations.some((r:any)=>['blocks','blocking'].includes(r.type));
 return {...issue,linkSourceTypes:issueLinkSources(issue),searchableContent:[issue.title,text(issue.description)].join(' ').replace(/\s+/g,' ').trim(),isParentIssue:issues?parents(issues).has(issue.id):!!issue.childIds?.length,isSubIssue:!!issue.parentId,isBlockedIssue:blocked,isBlockingIssue:blocking,isDuplicateIssue:!!issue.duplicateOfId||relations.some((r:any)=>r.type==='duplicate'),hasIssueRelations:!!(relations.length||issue.relatedIds?.length||blocked||blocking||issue.duplicateOfId),isRecurringIssue:!!(issue.recurrence||issue.recurrenceSourceId),recurringSeriesId:issueRecurringSeriesId(issue,issues)};
}
