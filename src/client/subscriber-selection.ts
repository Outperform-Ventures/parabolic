import type {Entity} from '../shared/types';
import {effectiveIssueSubscribers} from '../shared/issue-subscriptions';

export const subscriberValues=(issue:Entity):string[]=>issue.subscribers??effectiveIssueSubscribers(issue);
export function commonSubscribers(issues:Entity[]):string[] {
 return (issues.length?subscriberValues(issues[0]):[]).filter(id=>issues.every(issue=>subscriberValues(issue).includes(id)));
}
export function subscriberSelectionChanges(issues:Entity[],selected:string[],touched:string[]) {
 const edited=new Set(touched),checked=new Set(selected);
 return issues.flatMap(issue=>{
  const before=[...new Set(subscriberValues(issue))].sort();
  const subscribers=[...new Set([...before.filter(id=>!edited.has(id)),...touched.filter(id=>checked.has(id))])].sort();
  return JSON.stringify(before)===JSON.stringify(subscribers)?[]:[{kind:'issues' as const,id:issue.id,expectedVersion:issue.version,expectedFields:{subscribers:before},data:{replaceSubscribers:true,subscribers}}];
 });
}
